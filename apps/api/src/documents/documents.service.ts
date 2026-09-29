import { createHash, randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';

import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import {
  authorize,
  type AuthorizationContext,
  type ProtectedResource,
  type ResourceAction,
} from '@knowguard/authorization';
import {
  type Prisma,
  protectedDocumentSelect,
  readableDocumentsWhere,
  toProtectedResource,
} from '@knowguard/database';
import { documentObjectKey, type ObjectStorage, ObjectNotFoundError } from '@knowguard/storage';
import type {
  AclEntryView,
  AclSubjectTypeValue,
  DocumentCapabilities,
  DocumentDetails,
  DocumentListResponse,
  DocumentSummary,
  SubjectRef,
} from '@knowguard/types';
import type {
  AclEntryInput,
  CreateDocumentInput,
  ListDocumentsQuery,
  SetDocumentVisibilityInput,
  UpdateDocumentInput,
} from '@knowguard/validation';

import { type AuthContext, toAuthorizationContext } from '../auth/auth-context';
import { ApiException, notFound } from '../common/api-exception';
import { IngestionQueue } from '../common/ingestion-queue';
import { isUniqueViolation } from '../common/prisma-errors';
import { PrismaService } from '../common/prisma.service';
import { OBJECT_STORAGE } from '../common/storage.provider';
import { API_ENV, type ApiEnv } from '../config/api-env';
import { type DetectedFileType, detectFileType, sanitizeFilename } from './file-type';

/** The shape of a Multer in-memory upload that this service needs. */
export interface UploadedFileInput {
  buffer: Buffer;
  originalname: string;
  size: number;
}

interface InspectedUpload extends DetectedFileType {
  bytes: Buffer;
  size: number;
  contentHash: string;
  checksumSha256: string;
  originalFilename: string;
}

const summarySelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  mimeType: true,
  size: true,
  currentVersion: true,
  currentVersionId: true,
  storageKey: true,
  createdAt: true,
  updatedAt: true,
  owner: { select: { user: { select: { id: true, name: true, email: true } } } },
  ...protectedDocumentSelect, // organizationId, ownerId, visibility, audience, permissions
} satisfies Prisma.DocumentSelect;

type DocumentRow = Prisma.DocumentGetPayload<{ select: typeof summarySelect }>;

const AUDIENCE_TYPE: Partial<Record<CreateDocumentInput['visibility'], AclSubjectTypeValue>> = {
  ROLE: 'ROLE',
  TEAM: 'TEAM',
  DEPARTMENT: 'DEPARTMENT',
};

const accessDenied = (): ApiException =>
  new ApiException(
    'DOCUMENT_ACCESS_DENIED',
    'You do not have permission to perform this action on this document.',
    HttpStatus.FORBIDDEN,
  );

/**
 * Documents of the caller's organization. Every operation is decided by the authorization
 * engine (ADR 0007); listing uses its query-level twin (readableDocumentsWhere).
 *
 * Disclosure rule: a document the caller cannot READ is reported as 404 — identical to a
 * document that does not exist — so titles and existence never leak. A document the caller can
 * read but not modify yields 403 DOCUMENT_ACCESS_DENIED for the modification.
 */
@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);
  private readonly maxBytes: number;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    private readonly ingestion: IngestionQueue,
    @Inject(API_ENV) env: ApiEnv,
  ) {
    this.maxBytes = env.MAX_UPLOAD_MB * 1024 * 1024;
  }

  // ── reads ────────────────────────────────────────────────────────────────────────────

  async list(auth: AuthContext, query: ListDocumentsQuery): Promise<DocumentListResponse> {
    const context = toAuthorizationContext(auth);
    const where = readableDocumentsWhere(context);
    const [total, rows] = await Promise.all([
      this.prisma.document.count({ where }),
      this.prisma.document.findMany({
        where,
        select: summarySelect,
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return {
      documents: rows.map((row) => this.toSummary(row, context)),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  async get(auth: AuthContext, id: string): Promise<DocumentDetails> {
    const context = toAuthorizationContext(auth);
    const row = await this.requireAccess(context, id, 'READ');
    const resource = toProtectedResource(row);
    const canShare = authorize(context, 'SHARE', resource).allowed;

    const versions = await this.prisma.documentVersion.findMany({
      where: { documentId: id, organizationId: auth.organizationId },
      orderBy: { version: 'desc' },
      select: {
        id: true,
        version: true,
        originalFilename: true,
        mimeType: true,
        size: true,
        contentHash: true,
        createdAt: true,
        createdBy: { select: { user: { select: { id: true, name: true, email: true } } } },
      },
    });

    const audienceType = AUDIENCE_TYPE[row.visibility];
    const names = await this.resolveSubjects(auth.organizationId, [
      ...(audienceType ? row.audience.map((a) => ({ type: audienceType, id: a.targetId })) : []),
      ...(canShare ? row.permissions.map((p) => ({ type: p.subjectType, id: p.subjectId })) : []),
    ]);
    const ref = (type: AclSubjectTypeValue, subjectId: string): SubjectRef => ({
      type,
      id: subjectId,
      name: names.get(`${type}:${subjectId}`) ?? 'Unknown',
    });

    return {
      ...this.toSummary(row, context),
      createdAt: row.createdAt.toISOString(),
      versions: versions.map((version) => ({
        id: version.id,
        version: version.version,
        originalFilename: version.originalFilename,
        mimeType: version.mimeType,
        size: version.size,
        contentHash: version.contentHash,
        createdBy: version.createdBy.user,
        createdAt: version.createdAt.toISOString(),
      })),
      audience: audienceType ? row.audience.map((a) => ref(audienceType, a.targetId)) : [],
      acl: canShare
        ? row.permissions.map((entry): AclEntryView => ({
            subject: ref(entry.subjectType, entry.subjectId),
            permission: entry.permission,
            effect: entry.effect,
          }))
        : null,
    };
  }

  async download(
    auth: AuthContext,
    id: string,
    versionId?: string,
  ): Promise<{ body: Readable; mimeType: string; size: number; filename: string }> {
    const context = toAuthorizationContext(auth);
    const row = await this.requireAccess(context, id, 'READ');
    const targetVersionId = versionId ?? row.currentVersionId;
    if (!targetVersionId) throw notFound('document version');
    const version = await this.prisma.documentVersion.findFirst({
      where: { id: targetVersionId, documentId: id, organizationId: auth.organizationId },
      select: { storageKey: true, mimeType: true, size: true, originalFilename: true },
    });
    if (!version) throw notFound('document version');
    try {
      const object = await this.storage.getObject(version.storageKey);
      return {
        body: object.body,
        mimeType: version.mimeType,
        size: version.size,
        filename: version.originalFilename,
      };
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        this.logger.error(`Stored object missing for document ${id} (${version.storageKey})`);
        throw notFound('document file');
      }
      throw this.storageUnavailable(error);
    }
  }

  // ── writes ───────────────────────────────────────────────────────────────────────────

  /** Upload flow (spec §16): validate → store object → create document + version 1 → queue. */
  async create(
    auth: AuthContext,
    file: UploadedFileInput | undefined,
    input: CreateDocumentInput,
  ): Promise<DocumentDetails> {
    const upload = this.inspect(file);
    await this.validateAudience(auth.organizationId, input.visibility, input.audienceIds);

    const documentId = randomUUID();
    const versionId = randomUUID();
    const storageKey = documentObjectKey({
      organizationId: auth.organizationId,
      documentId,
      versionId,
      extension: upload.extension,
    });
    await this.putObject(storageKey, upload);

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.document.create({
          data: {
            id: documentId,
            organizationId: auth.organizationId,
            ownerId: auth.userId,
            title: input.title,
            description: input.description ?? null,
            visibility: input.visibility,
            status: 'PROCESSING',
            currentVersionId: versionId,
            currentVersion: 1,
            mimeType: upload.mimeType,
            size: upload.size,
            storageKey,
          },
        });
        await tx.documentVersion.create({
          data: this.versionData(auth, documentId, versionId, 1, storageKey, upload),
        });
        if (AUDIENCE_TYPE[input.visibility]) {
          await tx.documentAudience.createMany({
            data: input.audienceIds.map((targetId) => ({
              documentId,
              organizationId: auth.organizationId,
              targetId,
            })),
          });
        }
      });
    } catch (error) {
      await this.deleteObjectsQuietly([storageKey]);
      throw error;
    }

    await this.ingestion.enqueueProcessDocument({
      organizationId: auth.organizationId,
      documentId,
      versionId,
    });
    return this.get(auth, documentId);
  }

  /** Adds an immutable new version and makes it the active one (requires WRITE). */
  async addVersion(
    auth: AuthContext,
    id: string,
    file: UploadedFileInput | undefined,
  ): Promise<DocumentDetails> {
    const context = toAuthorizationContext(auth);
    const row = await this.requireAccess(context, id, 'WRITE');
    const upload = this.inspect(file);

    const versionId = randomUUID();
    const next = row.currentVersion + 1;
    const storageKey = documentObjectKey({
      organizationId: auth.organizationId,
      documentId: id,
      versionId,
      extension: upload.extension,
    });
    await this.putObject(storageKey, upload);

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.documentVersion.create({
          data: this.versionData(auth, id, versionId, next, storageKey, upload),
        });
        // Optimistic concurrency: only advance from the version we read.
        const advanced = await tx.document.updateMany({
          where: { id, organizationId: auth.organizationId, currentVersion: row.currentVersion },
          data: {
            currentVersionId: versionId,
            currentVersion: next,
            mimeType: upload.mimeType,
            size: upload.size,
            storageKey,
            status: 'PROCESSING',
          },
        });
        if (advanced.count !== 1) throw this.versionConflict();
      });
    } catch (error) {
      await this.deleteObjectsQuietly([storageKey]);
      if (isUniqueViolation(error)) throw this.versionConflict();
      throw error;
    }

    await this.ingestion.enqueueProcessDocument({
      organizationId: auth.organizationId,
      documentId: id,
      versionId,
    });
    return this.get(auth, id);
  }

  async update(auth: AuthContext, id: string, input: UpdateDocumentInput): Promise<DocumentDetails> {
    await this.requireAccess(toAuthorizationContext(auth), id, 'WRITE');
    await this.prisma.document.update({
      where: { id_organizationId: { id, organizationId: auth.organizationId } },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description || null } : {}),
      },
    });
    return this.get(auth, id);
  }

  /** Changes who INHERITS read access (requires SHARE). */
  async setVisibility(
    auth: AuthContext,
    id: string,
    input: SetDocumentVisibilityInput,
  ): Promise<DocumentDetails> {
    await this.requireAccess(toAuthorizationContext(auth), id, 'SHARE');
    await this.validateAudience(auth.organizationId, input.visibility, input.audienceIds);
    await this.prisma.$transaction(async (tx) => {
      await tx.document.update({
        where: { id_organizationId: { id, organizationId: auth.organizationId } },
        data: { visibility: input.visibility },
      });
      await tx.documentAudience.deleteMany({
        where: { documentId: id, organizationId: auth.organizationId },
      });
      if (AUDIENCE_TYPE[input.visibility]) {
        await tx.documentAudience.createMany({
          data: input.audienceIds.map((targetId) => ({
            documentId: id,
            organizationId: auth.organizationId,
            targetId,
          })),
        });
      }
    });
    return this.get(auth, id);
  }

  /**
   * Replaces the document's ACL (requires SHARE). No escalation: an ALLOW entry may only grant
   * an action the caller is currently allowed to perform on this document. DENY entries are
   * always permitted — restricting access is never an escalation.
   */
  async setAcl(auth: AuthContext, id: string, entries: AclEntryInput[]): Promise<DocumentDetails> {
    const context = toAuthorizationContext(auth);
    const row = await this.requireAccess(context, id, 'SHARE');
    const resource = toProtectedResource(row);

    for (const entry of entries) {
      if (entry.effect === 'ALLOW' && !authorize(context, entry.permission, resource).allowed) {
        throw new ApiException(
          'GRANT_EXCEEDS_YOUR_ACCESS',
          'You cannot grant access to this document that you do not have yourself.',
          HttpStatus.FORBIDDEN,
        );
      }
    }
    const known = await this.resolveSubjects(
      auth.organizationId,
      entries.map((e) => ({ type: e.subjectType, id: e.subjectId })),
    );
    if (entries.some((e) => !known.has(`${e.subjectType}:${e.subjectId}`))) throw this.unknownSubject();

    await this.prisma.$transaction(async (tx) => {
      await tx.documentPermission.deleteMany({
        where: { documentId: id, organizationId: auth.organizationId },
      });
      await tx.documentPermission.createMany({
        data: entries.map((e) => ({
          documentId: id,
          organizationId: auth.organizationId,
          subjectType: e.subjectType,
          subjectId: e.subjectId,
          permission: e.permission,
          effect: e.effect,
        })),
      });
      await tx.document.update({
        where: { id_organizationId: { id, organizationId: auth.organizationId } },
        data: { updatedAt: new Date() },
      });
    });
    return this.get(auth, id);
  }

  /** Deletes the document, all versions and ACLs; then removes the stored objects. */
  async remove(auth: AuthContext, id: string): Promise<void> {
    await this.requireAccess(toAuthorizationContext(auth), id, 'DELETE');
    const versions = await this.prisma.documentVersion.findMany({
      where: { documentId: id, organizationId: auth.organizationId },
      select: { storageKey: true },
    });
    await this.prisma.document.delete({
      where: { id_organizationId: { id, organizationId: auth.organizationId } },
    });
    await this.deleteObjectsQuietly(versions.map((v) => v.storageKey));
  }

  // ── access helpers ───────────────────────────────────────────────────────────────────

  /**
   * Loads a document of the caller's organization and enforces `action`:
   * cannot READ → 404 (indistinguishable from missing); can read but not `action` → 403.
   */
  private async requireAccess(
    context: AuthorizationContext,
    id: string,
    action: ResourceAction,
  ): Promise<DocumentRow> {
    const row = await this.prisma.document.findUnique({
      where: { id_organizationId: { id, organizationId: context.organizationId } },
      select: summarySelect,
    });
    if (!row) throw notFound('document');
    const resource = toProtectedResource(row);
    if (!authorize(context, 'READ', resource).allowed) throw notFound('document');
    if (action !== 'READ' && !authorize(context, action, resource).allowed) throw accessDenied();
    return row;
  }

  private capabilities(context: AuthorizationContext, resource: ProtectedResource): DocumentCapabilities {
    const can = (action: ResourceAction): boolean => authorize(context, action, resource).allowed;
    return { write: can('WRITE'), delete: can('DELETE'), share: can('SHARE') };
  }

  private toSummary(row: DocumentRow, context: AuthorizationContext): DocumentSummary {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      owner: row.owner.user,
      visibility: row.visibility,
      status: row.status,
      mimeType: row.mimeType,
      size: row.size,
      version: row.currentVersion,
      updatedAt: row.updatedAt.toISOString(),
      capabilities: this.capabilities(context, toProtectedResource(row)),
    };
  }

  // ── validation helpers ───────────────────────────────────────────────────────────────

  private inspect(file: UploadedFileInput | undefined): InspectedUpload {
    if (!file || file.size === 0) {
      throw new ApiException('FILE_REQUIRED', 'Choose a non-empty file to upload.', HttpStatus.BAD_REQUEST);
    }
    if (file.size > this.maxBytes) {
      throw new ApiException('PAYLOAD_TOO_LARGE', 'The file is too large.', HttpStatus.PAYLOAD_TOO_LARGE);
    }
    const detected = detectFileType(file.buffer, file.originalname);
    if (!detected) {
      throw new ApiException(
        'UNSUPPORTED_FILE_TYPE',
        'Only PDF, Word (.docx), Markdown and plain-text files are supported.',
        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
      );
    }
    const digest = createHash('sha256').update(file.buffer).digest();
    return {
      ...detected,
      bytes: file.buffer,
      size: file.size,
      contentHash: digest.toString('hex'),
      checksumSha256: digest.toString('base64'),
      originalFilename: sanitizeFilename(file.originalname, detected.extension),
    };
  }

  private versionData(
    auth: AuthContext,
    documentId: string,
    versionId: string,
    version: number,
    storageKey: string,
    upload: InspectedUpload,
  ): Prisma.DocumentVersionUncheckedCreateInput {
    return {
      id: versionId,
      organizationId: auth.organizationId,
      documentId,
      version,
      storageKey,
      contentHash: upload.contentHash,
      mimeType: upload.mimeType,
      size: upload.size,
      originalFilename: upload.originalFilename,
      createdById: auth.userId,
    };
  }

  /** ROLE/TEAM/DEPARTMENT need at least one audience of that type; other visibilities take none. */
  private async validateAudience(
    organizationId: string,
    visibility: CreateDocumentInput['visibility'],
    audienceIds: readonly string[],
  ): Promise<void> {
    const type = AUDIENCE_TYPE[visibility];
    if (!type) {
      if (audienceIds.length > 0) {
        throw new ApiException(
          'AUDIENCE_NOT_ALLOWED',
          `${visibility} visibility does not take an audience.`,
          HttpStatus.BAD_REQUEST,
        );
      }
      return;
    }
    if (audienceIds.length === 0) {
      throw new ApiException(
        'AUDIENCE_REQUIRED',
        `Choose at least one ${type.toLowerCase()} for ${visibility} visibility.`,
        HttpStatus.BAD_REQUEST,
      );
    }
    const known = await this.resolveSubjects(
      organizationId,
      audienceIds.map((id) => ({ type, id })),
    );
    if (known.size !== audienceIds.length) throw this.unknownSubject();
  }

  /** Names of users/roles/teams/departments that exist IN THIS ORGANIZATION, keyed "TYPE:id". */
  private async resolveSubjects(
    organizationId: string,
    refs: ReadonlyArray<{ type: AclSubjectTypeValue; id: string }>,
  ): Promise<Map<string, string>> {
    const ids = (type: AclSubjectTypeValue) => [
      ...new Set(refs.filter((r) => r.type === type).map((r) => r.id)),
    ];
    const [users, roles, teams, departments] = await Promise.all([
      ids('USER').length
        ? this.prisma.userOrganization.findMany({
            where: { organizationId, userId: { in: ids('USER') } },
            select: { user: { select: { id: true, name: true } } },
          })
        : [],
      ids('ROLE').length
        ? this.prisma.role.findMany({
            where: { organizationId, id: { in: ids('ROLE') } },
            select: { id: true, name: true },
          })
        : [],
      ids('TEAM').length
        ? this.prisma.team.findMany({
            where: { organizationId, id: { in: ids('TEAM') } },
            select: { id: true, name: true },
          })
        : [],
      ids('DEPARTMENT').length
        ? this.prisma.department.findMany({
            where: { organizationId, id: { in: ids('DEPARTMENT') } },
            select: { id: true, name: true },
          })
        : [],
    ]);
    return new Map<string, string>([
      ...users.map((m): [string, string] => [`USER:${m.user.id}`, m.user.name]),
      ...roles.map((r): [string, string] => [`ROLE:${r.id}`, r.name]),
      ...teams.map((t): [string, string] => [`TEAM:${t.id}`, t.name]),
      ...departments.map((d): [string, string] => [`DEPARTMENT:${d.id}`, d.name]),
    ]);
  }

  // ── storage helpers ──────────────────────────────────────────────────────────────────

  private async putObject(key: string, upload: InspectedUpload): Promise<void> {
    try {
      await this.storage.putObject({
        key,
        body: upload.bytes,
        contentType: upload.mimeType,
        checksumSha256: upload.checksumSha256,
      });
    } catch (error) {
      throw this.storageUnavailable(error);
    }
  }

  private async deleteObjectsQuietly(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    try {
      await this.storage.deleteObjects(keys);
    } catch (error) {
      // Orphaned objects are harmless (unreferenced, tenant-prefixed) but should be swept.
      this.logger.error(`Failed to delete ${keys.length} stored object(s): ${(error as Error).message}`);
    }
  }

  private storageUnavailable(error: unknown): ApiException {
    this.logger.error(`Object storage error: ${(error as Error).message}`);
    return new ApiException(
      'STORAGE_UNAVAILABLE',
      'Document storage is temporarily unavailable. Please try again shortly.',
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  private unknownSubject(): ApiException {
    return new ApiException(
      'UNKNOWN_SUBJECT',
      'One or more users, roles, teams or departments were not found in your organization.',
      HttpStatus.BAD_REQUEST,
    );
  }

  private versionConflict(): ApiException {
    return new ApiException(
      'VERSION_CONFLICT',
      'Another version was uploaded at the same time. Refresh and try again.',
      HttpStatus.CONFLICT,
    );
  }
}

import { createHash } from 'node:crypto';
import type { Stream } from 'node:stream';

import { type ObjectStorage, ObjectNotFoundError } from '@knowguard/storage';
import {
  INGESTION_JOBS,
  QUEUE_NAMES,
  type DocumentDetails,
  type DocumentListResponse,
} from '@knowguard/types';
import type { INestApplication } from '@nestjs/common';
import { Queue } from 'bullmq';

import type { PrismaService } from '../src/common/prisma.service';
import { OBJECT_STORAGE } from '../src/common/storage.provider';
import { createTestApp } from './test-app';
import { TestClient, type TestMember, type TestOwner } from './test-client';

let app: INestApplication;
let prisma: PrismaService;
let storage: ObjectStorage;
let api: TestClient;
let queue: Queue;

let owner: TestOwner;
let employee: TestMember; // EMPLOYEE: document.read + document.create
let manager: TestMember; // MANAGER: + document.update + document.share (no delete)
let outsider: TestOwner; // owner of another organization
let teamId: string;

const MISSING = '00000000-0000-4000-8000-000000000000';
const sha256 = (value: Buffer | string) => createHash('sha256').update(value).digest('hex');

interface UploadOptions {
  title?: string;
  content?: Buffer | string;
  filename?: string;
  visibility?: string;
  audienceIds?: string[];
  extra?: Record<string, string>;
}

function upload(token: string, options: UploadOptions = {}) {
  let req = api
    .as(token)
    .multipart('/documents')
    .field('title', options.title ?? 'Runbook')
    .field('visibility', options.visibility ?? 'PRIVATE');
  for (const id of options.audienceIds ?? []) req = req.field('audienceIds', id);
  for (const [key, value] of Object.entries(options.extra ?? {})) req = req.field(key, value);
  const content = options.content ?? `# Runbook\n\nDeploy with care. ${Math.random()}`;
  return req.attach(
    'file',
    Buffer.isBuffer(content) ? content : Buffer.from(content),
    options.filename ?? 'runbook.md',
  );
}

async function createDoc(token: string, options: UploadOptions = {}): Promise<DocumentDetails> {
  return (await upload(token, options).expect(201)).body as DocumentDetails;
}

/** Collects the raw response bytes, whatever the content type (supertest would parse text). */
function rawBody(res: Stream, callback: (error: Error | null, body: Buffer) => void): void {
  const chunks: Buffer[] = [];
  res.on('data', (chunk: Buffer) => chunks.push(chunk));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
}

async function readAll(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk as Uint8Array));
  return Buffer.concat(chunks);
}

beforeAll(async () => {
  ({ app, prisma } = await createTestApp());
  storage = app.get(OBJECT_STORAGE);
  api = new TestClient(app, prisma);
  const redisUrl = new URL(process.env.REDIS_URL!);
  queue = new Queue(QUEUE_NAMES.ingestion, {
    prefix: 'knowguard-test',
    connection: {
      host: redisUrl.hostname,
      port: Number(redisUrl.port || 6379),
      ...(redisUrl.password ? { password: decodeURIComponent(redisUrl.password) } : {}),
    },
  });

  owner = await api.registerOwner('Docs Org');
  employee = await api.addMember(owner.token, 'EMPLOYEE');
  manager = await api.addMember(owner.token, 'MANAGER');
  outsider = await api.registerOwner('Other Org');

  const dept = (await api.as(owner.token).post('/departments', { name: 'Engineering' }).expect(201)).body;
  teamId = (await api.as(owner.token).post('/teams', { name: 'Platform', departmentId: dept.id }).expect(201))
    .body.id;
  await api.as(owner.token).put(`/teams/${teamId}/members/${employee.userId}`).expect(204);
});

afterAll(async () => {
  await api?.cleanup();
  await queue?.close();
  await app?.close();
});

describe('upload', () => {
  it('stores the file, records version 1, and queues ingestion', async () => {
    const content = `# Payments\n\nDeploy via pipeline ${Date.now()}`;
    const doc = await createDoc(owner.token, {
      title: 'Payments Deployment Guide',
      content,
      filename: 'payments.md',
    });

    expect(doc).toMatchObject({
      title: 'Payments Deployment Guide',
      visibility: 'PRIVATE',
      status: 'PROCESSING',
      mimeType: 'text/markdown',
      version: 1,
      owner: { id: owner.userId },
      capabilities: { write: true, delete: true, share: true },
    });
    expect(doc.versions).toHaveLength(1);
    expect(doc.versions[0]).toMatchObject({
      version: 1,
      originalFilename: 'payments.md',
      contentHash: sha256(content),
    });

    const version = await prisma.documentVersion.findUniqueOrThrow({ where: { id: doc.versions[0]!.id } });
    expect(version.storageKey).toBe(
      `organizations/${owner.organizationId}/documents/${doc.id}/${version.id}/original.md`,
    );
    const stored = await readAll((await storage.getObject(version.storageKey)).body);
    expect(stored.toString()).toBe(content);

    const job = await queue.getJob(`process-${version.id}`);
    expect(job?.name).toBe(INGESTION_JOBS.processDocument);
    expect(job?.data).toEqual({
      organizationId: owner.organizationId,
      documentId: doc.id,
      versionId: version.id,
    });
  });

  it.each([
    [
      'an executable renamed to .pdf',
      Buffer.from([0x4d, 0x5a, 0x90, 0x00]),
      'invoice.pdf',
      415,
      'UNSUPPORTED_FILE_TYPE',
    ],
    ['binary data', Buffer.from([0x00, 0x01, 0x02, 0xff]), 'data.txt', 415, 'UNSUPPORTED_FILE_TYPE'],
    ['an empty file', Buffer.alloc(0), 'empty.txt', 400, 'FILE_REQUIRED'],
  ])('rejects %s', async (_label, content, filename, status, code) => {
    const res = await upload(owner.token, { content, filename }).expect(status);
    expect(res.body.error.code).toBe(code);
  });

  it('rejects files over the size limit', async () => {
    const res = await upload(owner.token, {
      content: Buffer.alloc(3 * 1024 * 1024, 'a'),
      filename: 'big.txt',
    });
    expect(res.status).toBe(413);
  });

  it('rejects a missing file and client-supplied ownership/tenant fields', async () => {
    await api.as(owner.token).multipart('/documents').field('title', 'No file').expect(400);
    for (const field of ['ownerId', 'organizationId', 'status']) {
      await upload(owner.token, { extra: { [field]: employee.userId } }).expect(400);
    }
  });

  it('validates the visibility audience', async () => {
    expect((await upload(owner.token, { visibility: 'TEAM' }).expect(400)).body.error.code).toBe(
      'AUDIENCE_REQUIRED',
    );
    expect(
      (await upload(owner.token, { visibility: 'ORGANIZATION', audienceIds: [teamId] }).expect(400)).body
        .error.code,
    ).toBe('AUDIENCE_NOT_ALLOWED');
    // A team from another organization is "unknown" here.
    const foreignDept = (await api.as(outsider.token).post('/departments', { name: 'X' }).expect(201)).body;
    const foreignTeam = (
      await api.as(outsider.token).post('/teams', { name: 'Y', departmentId: foreignDept.id }).expect(201)
    ).body;
    expect(
      (await upload(owner.token, { visibility: 'TEAM', audienceIds: [foreignTeam.id] }).expect(400)).body
        .error.code,
    ).toBe('UNKNOWN_SUBJECT');
  });

  it('requires the document.create capability', async () => {
    // Remove every role's create capability from a fresh custom role holder.
    const role = (
      await api
        .as(owner.token)
        .post('/roles', { name: 'Viewer', permissions: ['document.read'] })
        .expect(201)
    ).body;
    const viewer = await api.addMember(owner.token, 'EMPLOYEE');
    await api
      .as(owner.token)
      .put(`/users/${viewer.userId}/roles`, { roleKeys: [role.key] })
      .expect(200);
    await upload(viewer.token).expect(403);
  });
});

describe('read access follows the authorization engine', () => {
  it('PRIVATE documents are invisible to others — 404, identical to a missing document', async () => {
    const doc = await createDoc(owner.token, { title: 'Owner secret' });
    const hidden = await api.as(employee.token).get(`/documents/${doc.id}`).expect(404);
    const missing = await api.as(employee.token).get(`/documents/${MISSING}`).expect(404);
    expect(hidden.body).toEqual(missing.body);
    await api.as(employee.token).get(`/documents/${doc.id}/download`).expect(404);

    const list = (await api.as(employee.token).get('/documents?pageSize=100').expect(200))
      .body as DocumentListResponse;
    expect(list.documents.map((d) => d.id)).not.toContain(doc.id);
  });

  it('ORGANIZATION documents are readable and downloadable by every member', async () => {
    const content = `Handbook ${Date.now()}`;
    const doc = await createDoc(owner.token, {
      visibility: 'ORGANIZATION',
      content,
      filename: 'handbook.txt',
    });
    const view = (await api.as(employee.token).get(`/documents/${doc.id}`).expect(200))
      .body as DocumentDetails;
    expect(view.capabilities).toEqual({ write: false, delete: false, share: false });
    expect(view.acl).toBeNull(); // ACLs are only shown to those who may share

    const res = await api
      .as(employee.token)
      .get(`/documents/${doc.id}/download`)
      .buffer(true)
      .parse(rawBody)
      .expect(200);
    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.headers['content-disposition']).toContain('attachment; filename="handbook.txt"');
    expect((res.body as Buffer).toString()).toBe(content);
  });

  it('readable but not writable → 403 DOCUMENT_ACCESS_DENIED for changes', async () => {
    const doc = await createDoc(owner.token, { visibility: 'ORGANIZATION' });
    const res = await api.as(manager.token).patch(`/documents/${doc.id}`, { title: 'Hijacked' }).expect(403);
    expect(res.body.error.code).toBe('DOCUMENT_ACCESS_DENIED');
    await api.as(manager.token).put(`/documents/${doc.id}/permissions`, { entries: [] }).expect(403);
  });

  it('TEAM documents reach team members only', async () => {
    const doc = await createDoc(owner.token, { visibility: 'TEAM', audienceIds: [teamId] });
    await api.as(employee.token).get(`/documents/${doc.id}`).expect(200);
    await api.as(manager.token).get(`/documents/${doc.id}`).expect(404);
    expect(doc.audience).toEqual([{ type: 'TEAM', id: teamId, name: 'Platform' }]);
  });

  it('an explicit DENY overrides organization-wide visibility', async () => {
    const doc = await createDoc(owner.token, { visibility: 'ORGANIZATION' });
    await api
      .as(owner.token)
      .put(`/documents/${doc.id}/permissions`, {
        entries: [{ subjectType: 'USER', subjectId: employee.userId, permission: 'READ', effect: 'DENY' }],
      })
      .expect(200);
    await api.as(employee.token).get(`/documents/${doc.id}`).expect(404);
    await api.as(manager.token).get(`/documents/${doc.id}`).expect(200);
    const list = (await api.as(employee.token).get('/documents?pageSize=100').expect(200))
      .body as DocumentListResponse;
    expect(list.documents.map((d) => d.id)).not.toContain(doc.id);
  });

  it('other organizations can never see a document, whatever its visibility', async () => {
    const doc = await createDoc(owner.token, { visibility: 'ORGANIZATION' });
    await api.as(outsider.token).get(`/documents/${doc.id}`).expect(404);
    await api.as(outsider.token).get(`/documents/${doc.id}/download`).expect(404);
    await api.as(outsider.token).delete(`/documents/${doc.id}`).expect(404);
    const list = (await api.as(outsider.token).get('/documents?pageSize=100').expect(200))
      .body as DocumentListResponse;
    expect(list.documents.map((d) => d.id)).not.toContain(doc.id);
  });
});

describe('sharing (ACL) and editing', () => {
  it('an explicit WRITE grant lets a member edit and upload versions, but not share', async () => {
    const doc = await createDoc(owner.token, { visibility: 'CUSTOM' });
    await api
      .as(owner.token)
      .put(`/documents/${doc.id}/permissions`, {
        entries: [{ subjectType: 'USER', subjectId: manager.userId, permission: 'WRITE' }],
      })
      .expect(200);

    const edited = (
      await api.as(manager.token).patch(`/documents/${doc.id}`, { title: 'Edited' }).expect(200)
    ).body as DocumentDetails;
    expect(edited).toMatchObject({
      title: 'Edited',
      capabilities: { write: true, share: false, delete: false },
    });

    const v2 = (
      await api
        .as(manager.token)
        .multipart(`/documents/${doc.id}/versions`)
        .attach('file', Buffer.from('%PDF-1.7\nversion two'), 'v2.pdf')
        .expect(201)
    ).body as DocumentDetails;
    expect(v2).toMatchObject({ version: 2, mimeType: 'application/pdf', status: 'PROCESSING' });
    expect(v2.versions.map((v) => v.version)).toEqual([2, 1]);

    const res = await api
      .as(manager.token)
      .put(`/documents/${doc.id}/permissions`, { entries: [] })
      .expect(403);
    expect(res.body.error.code).toBe('DOCUMENT_ACCESS_DENIED');
  });

  it('cannot grant access you do not have on the document', async () => {
    const doc = await createDoc(owner.token, { visibility: 'CUSTOM' });
    await api
      .as(owner.token)
      .put(`/documents/${doc.id}/permissions`, {
        entries: [{ subjectType: 'USER', subjectId: manager.userId, permission: 'SHARE' }],
      })
      .expect(200);
    // Manager may share, but holds no WRITE on this document → cannot hand out WRITE.
    const res = await api
      .as(manager.token)
      .put(`/documents/${doc.id}/permissions`, {
        entries: [
          { subjectType: 'USER', subjectId: manager.userId, permission: 'SHARE' },
          { subjectType: 'USER', subjectId: employee.userId, permission: 'WRITE' },
        ],
      })
      .expect(403);
    expect(res.body.error.code).toBe('GRANT_EXCEEDS_YOUR_ACCESS');
    // Granting READ is within their access.
    await api
      .as(manager.token)
      .put(`/documents/${doc.id}/permissions`, {
        entries: [
          { subjectType: 'USER', subjectId: manager.userId, permission: 'SHARE' },
          { subjectType: 'USER', subjectId: employee.userId, permission: 'READ' },
        ],
      })
      .expect(200);
    await api.as(employee.token).get(`/documents/${doc.id}`).expect(200);
  });

  it('rejects ACL subjects from another organization', async () => {
    const doc = await createDoc(owner.token);
    const res = await api
      .as(owner.token)
      .put(`/documents/${doc.id}/permissions`, {
        entries: [{ subjectType: 'USER', subjectId: outsider.userId, permission: 'READ' }],
      })
      .expect(400);
    expect(res.body.error.code).toBe('UNKNOWN_SUBJECT');
  });

  it('shows the ACL with subject names to those who may share', async () => {
    const doc = await createDoc(owner.token, { visibility: 'CUSTOM' });
    const updated = (
      await api
        .as(owner.token)
        .put(`/documents/${doc.id}/permissions`, {
          entries: [{ subjectType: 'TEAM', subjectId: teamId, permission: 'READ' }],
        })
        .expect(200)
    ).body as DocumentDetails;
    expect(updated.acl).toEqual([
      { subject: { type: 'TEAM', id: teamId, name: 'Platform' }, permission: 'READ', effect: 'ALLOW' },
    ]);
    await api.as(employee.token).get(`/documents/${doc.id}`).expect(200);
  });

  it('changing visibility widens and narrows inherited access', async () => {
    const doc = await createDoc(owner.token);
    await api.as(employee.token).get(`/documents/${doc.id}`).expect(404);
    await api
      .as(owner.token)
      .put(`/documents/${doc.id}/visibility`, { visibility: 'ORGANIZATION' })
      .expect(200);
    await api.as(employee.token).get(`/documents/${doc.id}`).expect(200);
    await api
      .as(owner.token)
      .put(`/documents/${doc.id}/visibility`, { visibility: 'TEAM', audienceIds: [teamId] })
      .expect(200);
    await api.as(employee.token).get(`/documents/${doc.id}`).expect(200);
    await api.as(manager.token).get(`/documents/${doc.id}`).expect(404);
  });
});

describe('versions and deletion', () => {
  it('keeps every version immutable and downloadable', async () => {
    const doc = await createDoc(owner.token, { content: 'first', filename: 'notes.txt' });
    const v2 = (
      await api
        .as(owner.token)
        .multipart(`/documents/${doc.id}/versions`)
        .attach('file', Buffer.from('second'), 'notes.txt')
        .expect(201)
    ).body as DocumentDetails;
    const v1Id = v2.versions.find((v) => v.version === 1)!.id;

    const latest = await api
      .as(owner.token)
      .get(`/documents/${doc.id}/download`)
      .buffer(true)
      .parse(rawBody)
      .expect(200);
    expect((latest.body as Buffer).toString()).toBe('second');
    const original = await api
      .as(owner.token)
      .get(`/documents/${doc.id}/versions/${v1Id}/download`)
      .buffer(true)
      .parse(rawBody)
      .expect(200);
    expect((original.body as Buffer).toString()).toBe('first');
  });

  it('deleting requires the capability and removes rows and stored objects', async () => {
    const doc = await createDoc(owner.token, { visibility: 'ORGANIZATION' });
    await api.as(manager.token).delete(`/documents/${doc.id}`).expect(403); // MANAGER lacks document.delete
    const keys = (await prisma.documentVersion.findMany({ where: { documentId: doc.id } })).map(
      (v) => v.storageKey,
    );

    await api.as(owner.token).delete(`/documents/${doc.id}`).expect(204);
    await api.as(owner.token).get(`/documents/${doc.id}`).expect(404);
    for (const key of keys) {
      await expect(storage.getObject(key)).rejects.toBeInstanceOf(ObjectNotFoundError);
    }
  });

  it('deleting a team removes ACL entries and audiences that reference it', async () => {
    const dept = (await api.as(owner.token).post('/departments', { name: 'Temp Dept' }).expect(201)).body;
    const team = (
      await api.as(owner.token).post('/teams', { name: 'Temp', departmentId: dept.id }).expect(201)
    ).body;
    const doc = await createDoc(owner.token, { visibility: 'TEAM', audienceIds: [team.id] });
    await api
      .as(owner.token)
      .put(`/documents/${doc.id}/permissions`, {
        entries: [{ subjectType: 'TEAM', subjectId: team.id, permission: 'WRITE' }],
      })
      .expect(200);
    await api.as(owner.token).delete(`/teams/${team.id}`).expect(204);
    expect(await prisma.documentPermission.count({ where: { subjectId: team.id } })).toBe(0);
    expect(await prisma.documentAudience.count({ where: { targetId: team.id } })).toBe(0);
  });
});

describe('reindexing (Phase 6)', () => {
  it('queues a REINDEX_DOCUMENT job for the current version and resets the status', async () => {
    const doc = await createDoc(owner.token, { visibility: 'ORGANIZATION' });
    expect(doc).toMatchObject({ chunkCount: 0, processingError: null, indexedAt: null });
    await prisma.document.update({
      where: { id: doc.id },
      data: { status: 'FAILED', processingError: 'boom' },
    });

    const res = await api.as(owner.token).post(`/documents/${doc.id}/reindex`).expect(202);
    expect(res.body).toMatchObject({ status: 'PROCESSING', processingError: null });

    const jobs = await queue.getJobs(['waiting', 'delayed', 'prioritized']);
    const reindex = jobs.find(
      (j) => j.name === INGESTION_JOBS.reindexDocument && j.data.documentId === doc.id,
    );
    expect(reindex?.data).toEqual({
      organizationId: owner.organizationId,
      documentId: doc.id,
      versionId: doc.versions[0]!.id,
    });
  });

  it('requires WRITE on the document, and is invisible across tenants', async () => {
    const doc = await createDoc(owner.token, { visibility: 'ORGANIZATION' });
    expect(
      (await api.as(manager.token).post(`/documents/${doc.id}/reindex`).expect(403)).body.error.code,
    ).toBe('DOCUMENT_ACCESS_DENIED');
    await api.as(employee.token).post(`/documents/${doc.id}/reindex`).expect(403); // no document.update
    await api.as(outsider.token).post(`/documents/${doc.id}/reindex`).expect(404);
  });
});

import { randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';

import { type EmbeddingProvider, toVectorLiteral } from '@knowguard/ai';
import { Prisma, type PrismaClient } from '@knowguard/database';
import type { Logger } from '@knowguard/logger';
import { type ObjectStorage, ObjectNotFoundError } from '@knowguard/storage';
import type { ProcessDocumentJob } from '@knowguard/types';

import { IngestionError } from './blocks';
import type { Chunker, DraftChunk } from './chunker';
import { extractBlocks } from './extract';

export interface IngestionDeps {
  prisma: PrismaClient;
  storage: ObjectStorage;
  embeddings: EmbeddingProvider;
  chunker: Chunker;
  logger: Logger;
}

export type IngestionOutcome =
  | { status: 'indexed'; chunks: number }
  | { status: 'skipped'; reason: 'document_not_found' | 'version_superseded' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_CHUNKS = 10_000;
const INSERT_BATCH = 200;

/**
 * PROCESS_DOCUMENT (spec §17): download → extract → normalize → chunk → embed → store.
 *
 * - The job payload is not trusted: organization, document and version must all match in the
 *   database, so a job can never touch another tenant's document.
 * - Only the ACTIVE version is indexed. A superseded version is skipped, and the final write
 *   re-checks under a row lock, so a slow old job can never overwrite a newer version's chunks.
 * - Idempotent: re-running replaces the document's chunks rather than adding to them.
 */
export async function processDocument(
  deps: IngestionDeps,
  job: ProcessDocumentJob,
): Promise<IngestionOutcome> {
  const { prisma, logger } = deps;
  if (
    ![job.organizationId, job.documentId, job.versionId].every(
      (id) => typeof id === 'string' && UUID.test(id),
    )
  ) {
    throw new IngestionError('Malformed ingestion job.');
  }

  const version = await prisma.documentVersion.findFirst({
    where: { id: job.versionId, documentId: job.documentId, organizationId: job.organizationId },
    select: {
      storageKey: true,
      mimeType: true,
      document: { select: { title: true, currentVersionId: true } },
    },
  });
  if (!version) return { status: 'skipped', reason: 'document_not_found' };
  if (version.document.currentVersionId !== job.versionId)
    return { status: 'skipped', reason: 'version_superseded' };

  await setStatus(prisma, job, 'PROCESSING');
  const bytes = await download(deps.storage, version.storageKey);
  const blocks = await extractBlocks(bytes, version.mimeType);
  const drafts = deps.chunker.chunk(blocks);
  if (drafts.length === 0) throw new IngestionError('No text could be extracted from the document.');
  if (drafts.length > MAX_CHUNKS) throw new IngestionError('The document is too large to index.');

  await setStatus(prisma, job, 'INDEXING');
  const vectors = await deps.embeddings.embedDocuments(
    drafts.map((d) => embeddingInput(version.document.title, d)),
  );
  if (vectors.length !== drafts.length)
    throw new Error('Embedding provider returned the wrong number of vectors');

  const stored = await prisma.$transaction(
    async (tx) => {
      const [current] = await tx.$queryRaw<Array<{ current_version_id: string | null }>>`
        SELECT current_version_id FROM documents
        WHERE id = ${job.documentId}::uuid AND organization_id = ${job.organizationId}::uuid
        FOR UPDATE`;
      if (!current || current.current_version_id !== job.versionId) return false;

      // Only the active version keeps chunks: drop every chunk of the document, then insert.
      await tx.documentChunk.deleteMany({
        where: { documentId: job.documentId, organizationId: job.organizationId },
      });
      for (let i = 0; i < drafts.length; i += INSERT_BATCH) {
        const rows = drafts.slice(i, i + INSERT_BATCH).map((draft, offset) => {
          const index = i + offset;
          const vector = vectors[index];
          if (!vector) throw new Error(`Missing embedding for chunk ${index}`);
          return Prisma.sql`(${randomUUID()}::uuid, ${job.organizationId}::uuid, ${job.documentId}::uuid,
            ${job.versionId}::uuid, ${index}, ${draft.content}, ${draft.tokenCount},
            ${JSON.stringify(draft.metadata)}::jsonb, ${toVectorLiteral(vector)}::vector,
            ${deps.embeddings.model})`;
        });
        await tx.$executeRaw`
          INSERT INTO document_chunks
            (id, organization_id, document_id, version_id, chunk_index, content, token_count,
             metadata, embedding, embedding_model)
          VALUES ${Prisma.join(rows)}`;
      }
      await tx.document.update({
        where: { id_organizationId: { id: job.documentId, organizationId: job.organizationId } },
        data: { status: 'READY', processingError: null, indexedAt: new Date() },
      });
      return true;
    },
    { timeout: 120_000 },
  );

  if (!stored) return { status: 'skipped', reason: 'version_superseded' };
  logger.info(
    { documentId: job.documentId, versionId: job.versionId, chunks: drafts.length },
    'Document indexed',
  );
  return { status: 'indexed', chunks: drafts.length };
}

/**
 * Records a terminal failure on the document (only if this version is still current). The
 * message is user-facing: IngestionError messages are written for users; anything else is
 * replaced by a generic message so internals never leak into the UI.
 */
export async function markFailed(
  prisma: PrismaClient,
  job: ProcessDocumentJob,
  error: unknown,
): Promise<void> {
  const message =
    error instanceof IngestionError
      ? error.message
      : 'Indexing failed after several attempts. Try reindexing the document later.';
  await prisma.document.updateMany({
    where: { id: job.documentId, organizationId: job.organizationId, currentVersionId: job.versionId },
    data: { status: 'FAILED', processingError: message.slice(0, 500) },
  });
}

/** Chunk text plus its document title and section, so the vector carries its context. */
export function embeddingInput(title: string, draft: DraftChunk): string {
  return [title, draft.metadata.section, '', draft.content]
    .filter((part) => part !== null)
    .join('\n')
    .trim();
}

async function setStatus(prisma: PrismaClient, job: ProcessDocumentJob, status: 'PROCESSING' | 'INDEXING') {
  await prisma.document.updateMany({
    where: { id: job.documentId, organizationId: job.organizationId, currentVersionId: job.versionId },
    data: { status, processingError: null },
  });
}

async function download(storage: ObjectStorage, key: string): Promise<Buffer> {
  try {
    const object = await storage.getObject(key);
    const chunks: Buffer[] = [];
    for await (const chunk of object.body as Readable) chunks.push(Buffer.from(chunk as Uint8Array));
    return Buffer.concat(chunks);
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      throw new IngestionError('The stored file is missing. Upload the document again.', false, {
        cause: error,
      });
    }
    throw error; // transient storage errors are retried
  }
}

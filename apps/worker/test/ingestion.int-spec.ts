/**
 * Ingestion pipeline against real PostgreSQL + pgvector, S3-compatible storage and the real
 * local embedding model. Also runs one job end-to-end through BullMQ.
 */
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { LocalEmbeddingProvider, toVectorLiteral } from '@knowguard/ai';
import { createPrismaClient, type PrismaClient } from '@knowguard/database';
import { createLogger } from '@knowguard/logger';
import { documentObjectKey, S3ObjectStorage } from '@knowguard/storage';
import { INGESTION_JOBS, type ProcessDocumentJob, QUEUE_NAMES } from '@knowguard/types';
import { Queue, QueueEvents, UnrecoverableError, Worker } from 'bullmq';
import Redis from 'ioredis';

import { SectionChunker } from '../src/ingestion/chunker';
import { makePdf } from '../src/ingestion/fixtures';
import { createIngestionHandler } from '../src/ingestion/handler';
import { processDocument } from '../src/ingestion/process-document';
import { JobRegistry } from '../src/jobs/registry';

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be set for worker integration tests`);
  return value;
}

const logger = createLogger({ name: 'worker-test', level: 'silent' });
let prisma: PrismaClient;
const storage = new S3ObjectStorage({
  endpoint: env('STORAGE_ENDPOINT'),
  region: process.env.STORAGE_REGION ?? 'us-east-1',
  bucket: `${env('STORAGE_BUCKET')}-test`,
  accessKeyId: env('STORAGE_ACCESS_KEY_ID'),
  secretAccessKey: env('STORAGE_SECRET_ACCESS_KEY'),
  forcePathStyle: true,
});
const embeddings = new LocalEmbeddingProvider({
  cacheDir: process.env.EMBEDDING_CACHE_DIR ?? join(homedir(), '.cache', 'knowguard', 'models'),
  allowRemoteModels: true,
});
const chunker = new SectionChunker();
const deps = () => ({ prisma, storage, embeddings, chunker, logger });

const orgs: string[] = [];
let userId: string;
let orgId: string;

const GUIDE = [
  '# Payments Deployment Guide',
  '',
  '## Deploying',
  '',
  'Merge to main, then promote the release in the delivery pipeline. The payments service must pass its smoke tests.',
  '',
  '## Rollback',
  '',
  'If the smoke tests fail, revert the release from the pipeline dashboard within five minutes.',
  '',
  '# Holiday Policy',
  '',
  'Employees receive twenty five days of annual leave per calendar year.',
].join('\n');

async function createOrgWithUser(label: string) {
  const org = await prisma.organization.create({
    data: { name: label, slug: `ing-${label}-${randomUUID().slice(0, 8)}` },
  });
  const user = await prisma.user.create({
    data: {
      email: `ing-${randomUUID().slice(0, 8)}@example.test`,
      name: label,
      status: 'ACTIVE',
      memberships: { create: { organizationId: org.id, status: 'ACTIVE' } },
    },
  });
  orgs.push(org.id);
  return { orgId: org.id, userId: user.id };
}

/** Creates a document + version row and stores its bytes, like the API upload does. */
async function seedDocument(
  content: Buffer,
  mimeType: string,
  extension: string,
  organizationId = orgId,
  ownerId = userId,
) {
  const documentId = randomUUID();
  const versionId = randomUUID();
  const storageKey = documentObjectKey({ organizationId, documentId, versionId, extension });
  await storage.putObject({ key: storageKey, body: content, contentType: mimeType });
  await prisma.document.create({
    data: {
      id: documentId,
      organizationId,
      ownerId,
      title: 'Payments Deployment Guide',
      visibility: 'ORGANIZATION',
      status: 'PROCESSING',
      currentVersionId: versionId,
      currentVersion: 1,
      mimeType,
      size: content.length,
      storageKey,
    },
  });
  await prisma.documentVersion.create({
    data: {
      id: versionId,
      organizationId,
      documentId,
      version: 1,
      storageKey,
      contentHash: 'x'.repeat(64),
      mimeType,
      size: content.length,
      originalFilename: `file.${extension}`,
      createdById: ownerId,
    },
  });
  return { organizationId, documentId, versionId } satisfies ProcessDocumentJob;
}

beforeAll(async () => {
  prisma = createPrismaClient({ url: env('TEST_DATABASE_URL') });
  await storage.ensureBucket();
  ({ orgId, userId } = await createOrgWithUser('ingest-a'));
});

afterAll(async () => {
  await prisma.document.deleteMany({ where: { organizationId: { in: orgs } } });
  const memberships = await prisma.userOrganization.findMany({ where: { organizationId: { in: orgs } } });
  await prisma.user.deleteMany({ where: { id: { in: memberships.map((m) => m.userId) } } });
  await prisma.organization.deleteMany({ where: { id: { in: orgs } } });
  await prisma.$disconnect();
});

describe('processDocument', () => {
  it('indexes a Markdown document: chunks with sections, 384-d embeddings, status READY', async () => {
    const job = await seedDocument(Buffer.from(GUIDE), 'text/markdown', 'md');
    const outcome = await processDocument(deps(), job);
    expect(outcome).toEqual({ status: 'indexed', chunks: 3 });

    const chunks = await prisma.documentChunk.findMany({
      where: { documentId: job.documentId },
      orderBy: { chunkIndex: 'asc' },
    });
    expect(chunks.map((c) => (c.metadata as { section: string }).section)).toEqual([
      'Payments Deployment Guide > Deploying',
      'Payments Deployment Guide > Rollback',
      'Holiday Policy',
    ]);
    expect(chunks.every((c) => c.organizationId === orgId && c.versionId === job.versionId)).toBe(true);
    expect(chunks[0]!.embeddingModel).toBe('Xenova/bge-small-en-v1.5');

    const dims = await prisma.$queryRaw<Array<{ dims: number }>>`
      SELECT vector_dims(embedding) AS dims FROM document_chunks WHERE document_id = ${job.documentId}::uuid`;
    expect(dims.map((d) => d.dims)).toEqual([384, 384, 384]);

    const doc = await prisma.document.findUniqueOrThrow({ where: { id: job.documentId } });
    expect(doc).toMatchObject({ status: 'READY', processingError: null });
    expect(doc.indexedAt).not.toBeNull();
  });

  it('stores vectors that retrieve the semantically right chunk', async () => {
    const job = await seedDocument(Buffer.from(GUIDE), 'text/markdown', 'md');
    await processDocument(deps(), job);
    const query = toVectorLiteral(await embeddings.embedQuery('How do I undo a bad payments release?'));
    const [best] = await prisma.$queryRaw<Array<{ content: string }>>`
      SELECT content FROM document_chunks WHERE document_id = ${job.documentId}::uuid
      ORDER BY embedding <=> ${query}::vector LIMIT 1`;
    expect(best!.content).toContain('revert the release');
  });

  it('indexes PDFs with page numbers', async () => {
    const pdf = await makePdf([
      ['Introduction to the payments platform.'],
      ['Deployment requires two approvals.'],
    ]);
    const job = await seedDocument(pdf, 'application/pdf', 'pdf');
    await processDocument(deps(), job);
    const chunks = await prisma.documentChunk.findMany({ where: { documentId: job.documentId } });
    const pages = chunks.flatMap((c) => {
      const m = c.metadata as { pageStart: number; pageEnd: number };
      return [m.pageStart, m.pageEnd];
    });
    expect(Math.min(...pages)).toBe(1);
    expect(Math.max(...pages)).toBe(2);
  });

  it('is idempotent: re-running replaces chunks instead of duplicating them', async () => {
    const job = await seedDocument(Buffer.from(GUIDE), 'text/markdown', 'md');
    await processDocument(deps(), job);
    await processDocument(deps(), job);
    expect(await prisma.documentChunk.count({ where: { documentId: job.documentId } })).toBe(3);
  });

  it('skips a superseded version and keeps only the active version’s chunks', async () => {
    const job = await seedDocument(Buffer.from(GUIDE), 'text/markdown', 'md');
    await processDocument(deps(), job);

    // A second version becomes current.
    const v2 = randomUUID();
    const key = documentObjectKey({
      organizationId: orgId,
      documentId: job.documentId,
      versionId: v2,
      extension: 'txt',
    });
    await storage.putObject({
      key,
      body: Buffer.from('Version two replaces everything.'),
      contentType: 'text/plain',
    });
    await prisma.documentVersion.create({
      data: {
        id: v2,
        organizationId: orgId,
        documentId: job.documentId,
        version: 2,
        storageKey: key,
        contentHash: 'y'.repeat(64),
        mimeType: 'text/plain',
        size: 32,
        originalFilename: 'v2.txt',
        createdById: userId,
      },
    });
    await prisma.document.update({
      where: { id: job.documentId },
      data: {
        currentVersionId: v2,
        currentVersion: 2,
        mimeType: 'text/plain',
        storageKey: key,
        status: 'PROCESSING',
      },
    });

    expect(await processDocument(deps(), job)).toEqual({ status: 'skipped', reason: 'version_superseded' });
    await processDocument(deps(), { ...job, versionId: v2 });
    const chunks = await prisma.documentChunk.findMany({ where: { documentId: job.documentId } });
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({ versionId: v2, content: 'Version two replaces everything.' });
  });

  it('never processes a job whose organization does not own the document', async () => {
    const job = await seedDocument(Buffer.from(GUIDE), 'text/markdown', 'md');
    const other = await createOrgWithUser('ingest-b');
    expect(await processDocument(deps(), { ...job, organizationId: other.orgId })).toEqual({
      status: 'skipped',
      reason: 'document_not_found',
    });
    expect(await prisma.documentChunk.count({ where: { documentId: job.documentId } })).toBe(0);
  });

  it('rejects malformed job payloads', async () => {
    await expect(
      processDocument(deps(), { organizationId: "x' OR 1=1 --", documentId: 'y', versionId: 'z' }),
    ).rejects.toThrow('Malformed ingestion job.');
  });
});

describe('ingestion handler failures', () => {
  it('marks unreadable documents FAILED immediately with a user-safe message', async () => {
    const job = await seedDocument(Buffer.from('%PDF-1.7 not really a pdf'), 'application/pdf', 'pdf');
    const handler = createIngestionHandler({ prisma, storage, embeddings, chunker });
    const fakeJob = { data: job, attemptsMade: 0, opts: { attempts: 5 } } as never;
    await expect(handler(fakeJob, logger)).rejects.toBeInstanceOf(UnrecoverableError);
    const doc = await prisma.document.findUniqueOrThrow({ where: { id: job.documentId } });
    expect(doc).toMatchObject({
      status: 'FAILED',
      processingError: 'The PDF could not be read. It may be corrupt or password-protected.',
    });
  });

  it('only marks transient failures FAILED on the last attempt', async () => {
    const job = await seedDocument(Buffer.from(GUIDE), 'text/markdown', 'md');
    const broken = {
      ...storage,
      getObject: () => Promise.reject(new Error('ECONNRESET 10.0.0.9:8333')),
    } as never;
    const handler = createIngestionHandler({ prisma, storage: broken, embeddings, chunker });

    await expect(
      handler({ data: job, attemptsMade: 0, opts: { attempts: 3 } } as never, logger),
    ).rejects.toThrow('ECONNRESET');
    expect((await prisma.document.findUniqueOrThrow({ where: { id: job.documentId } })).status).toBe(
      'PROCESSING',
    );

    await expect(
      handler({ data: job, attemptsMade: 2, opts: { attempts: 3 } } as never, logger),
    ).rejects.toThrow();
    const doc = await prisma.document.findUniqueOrThrow({ where: { id: job.documentId } });
    expect(doc.status).toBe('FAILED');
    expect(doc.processingError).not.toContain('10.0.0.9'); // internals never reach users
  });
});

describe('through BullMQ', () => {
  it('a queued PROCESS_DOCUMENT job is consumed and indexed', async () => {
    const job = await seedDocument(Buffer.from(GUIDE), 'text/markdown', 'md');
    const queueName = `${QUEUE_NAMES.ingestion}-test-${randomUUID().slice(0, 8)}`;
    const connection = new Redis(env('REDIS_URL'), { maxRetriesPerRequest: null });
    const registry = new JobRegistry().register(
      INGESTION_JOBS.processDocument,
      createIngestionHandler({ prisma, storage, embeddings, chunker }),
    );
    const worker = new Worker(queueName, (j) => registry.dispatch(j, logger), { connection });
    const queue = new Queue(queueName, { connection });
    // BullMQ never closes connections it is given, so every client here is closed explicitly.
    const eventsConnection = connection.duplicate();
    const events = new QueueEvents(queueName, { connection: eventsConnection });
    try {
      await events.waitUntilReady();
      const queued = await queue.add(INGESTION_JOBS.processDocument, job, {
        jobId: `process-${job.versionId}`,
      });
      await expect(queued.waitUntilFinished(events, 60_000)).resolves.toEqual({
        status: 'indexed',
        chunks: 3,
      });
      expect((await prisma.document.findUniqueOrThrow({ where: { id: job.documentId } })).status).toBe(
        'READY',
      );
    } finally {
      await worker.close();
      await events.close();
      await queue.obliterate({ force: true });
      await queue.close();
      await eventsConnection.quit();
      await connection.quit();
    }
  });
});

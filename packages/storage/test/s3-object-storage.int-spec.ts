/**
 * Integration test against a real S3-compatible store (SeaweedFS in docker compose / CI).
 * Uses a dedicated test bucket.
 */
import { createHash, randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';

import { documentObjectKey, ObjectNotFoundError, S3ObjectStorage } from '../src';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be set for storage integration tests`);
  return value;
}

const storage = new S3ObjectStorage({
  endpoint: requireEnv('STORAGE_ENDPOINT'),
  region: process.env.STORAGE_REGION ?? 'us-east-1',
  bucket: `${requireEnv('STORAGE_BUCKET')}-test`,
  accessKeyId: requireEnv('STORAGE_ACCESS_KEY_ID'),
  secretAccessKey: requireEnv('STORAGE_SECRET_ACCESS_KEY'),
  forcePathStyle: true,
});

async function readAll(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk as Uint8Array));
  return Buffer.concat(chunks);
}

const newKey = () =>
  documentObjectKey({
    organizationId: randomUUID(),
    documentId: randomUUID(),
    versionId: randomUUID(),
    extension: 'txt',
  });

beforeAll(async () => {
  await storage.ensureBucket();
  await storage.ensureBucket(); // idempotent
});

describe('S3ObjectStorage', () => {
  it('round-trips an object with its content type', async () => {
    const key = newKey();
    const body = Buffer.from(`hello ${randomUUID()}`);
    await storage.putObject({
      key,
      body,
      contentType: 'text/plain',
      checksumSha256: createHash('sha256').update(body).digest('base64'),
    });
    const stored = await storage.getObject(key);
    expect(stored.contentType).toBe('text/plain');
    expect(await readAll(stored.body)).toEqual(body);
    await storage.deleteObjects([key]);
  });

  it('rejects a body that does not match its declared checksum', async () => {
    await expect(
      storage.putObject({
        key: newKey(),
        body: Buffer.from('actual content'),
        contentType: 'text/plain',
        checksumSha256: createHash('sha256').update('different content').digest('base64'),
      }),
    ).rejects.toThrow();
  });

  it('reports missing objects as ObjectNotFoundError, including after deletion', async () => {
    const key = newKey();
    await expect(storage.getObject(key)).rejects.toBeInstanceOf(ObjectNotFoundError);
    await storage.putObject({ key, body: Buffer.from('x'), contentType: 'text/plain' });
    await storage.deleteObjects([key]);
    await expect(storage.getObject(key)).rejects.toBeInstanceOf(ObjectNotFoundError);
  });

  it('answers ping when reachable', async () => {
    await expect(storage.ping()).resolves.toBeUndefined();
  });
});

import type { Readable } from 'node:stream';

/**
 * Provider-neutral object storage contract (S3, MinIO, R2, ...). Implemented in Phase 5.
 * Callers pass fully-built, tenant-prefixed keys; this layer performs no authorization.
 */
export interface ObjectStorage {
  putObject(input: {
    key: string;
    body: Buffer | Readable;
    contentType: string;
    contentLength: number;
  }): Promise<void>;
  getObject(key: string): Promise<Readable>;
  deleteObject(key: string): Promise<void>;
}

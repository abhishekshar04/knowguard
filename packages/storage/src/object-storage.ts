import type { Readable } from 'node:stream';

export interface StoredObject {
  body: Readable;
  contentType: string | undefined;
  contentLength: number | undefined;
}

/**
 * Provider-neutral object storage contract (S3, SeaweedFS, MinIO, R2, …).
 *
 * This layer performs NO authorization: callers must authorize first and pass fully-built,
 * tenant-prefixed keys (see documentObjectKey). Keys never come from client input.
 */
export interface ObjectStorage {
  putObject(input: {
    key: string;
    body: Buffer;
    contentType: string;
    /** Base64 SHA-256 of the body; the store verifies integrity on write when supported. */
    checksumSha256?: string;
  }): Promise<void>;
  getObject(key: string): Promise<StoredObject>;
  deleteObjects(keys: readonly string[]): Promise<void>;
  /** Creates the bucket if it does not exist (development/test convenience). */
  ensureBucket(): Promise<void>;
  /** Cheap reachability check for health endpoints. */
  ping(): Promise<void>;
}

export class ObjectNotFoundError extends Error {
  constructor(readonly key: string) {
    super('Object not found');
    this.name = 'ObjectNotFoundError';
  }
}

import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { type ObjectStorage, S3ObjectStorage } from '@knowguard/storage';

import { API_ENV, type ApiEnv } from '../config/api-env';

/** DI token for the ObjectStorage implementation (S3-compatible). */
export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');

export const objectStorageProvider = {
  provide: OBJECT_STORAGE,
  inject: [API_ENV],
  useFactory: (env: ApiEnv): ObjectStorage =>
    new S3ObjectStorage({
      ...(env.STORAGE_ENDPOINT ? { endpoint: env.STORAGE_ENDPOINT } : {}),
      region: env.STORAGE_REGION,
      bucket: env.STORAGE_BUCKET,
      accessKeyId: env.STORAGE_ACCESS_KEY_ID,
      secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY,
      forcePathStyle: env.STORAGE_FORCE_PATH_STYLE,
    }),
};

/** Creates the bucket at startup when STORAGE_AUTO_CREATE_BUCKET=true (dev/test only). */
@Injectable()
export class StorageBootstrap implements OnApplicationBootstrap {
  private readonly logger = new Logger(StorageBootstrap.name);

  constructor(
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    @Inject(API_ENV) private readonly env: ApiEnv,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.env.STORAGE_AUTO_CREATE_BUCKET) return;
    try {
      await this.storage.ensureBucket();
    } catch (error) {
      // Uploads fail with 503 until storage is reachable; /health reports it.
      this.logger.error(`Could not ensure storage bucket: ${(error as Error).message}`);
    }
  }
}

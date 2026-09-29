import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

import { API_ENV, type ApiEnv } from '../config/api-env';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

@Module({
  imports: [
    MulterModule.registerAsync({
      inject: [API_ENV],
      useFactory: (env: ApiEnv) => ({
        // In memory: files are bounded by MAX_UPLOAD_MB and hashed + type-checked before storage.
        storage: memoryStorage(),
        limits: {
          fileSize: env.MAX_UPLOAD_MB * 1024 * 1024,
          files: 1,
          fields: 60,
          fieldSize: 64 * 1024,
          parts: 70,
        },
      }),
    }),
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService],
})
export class DocumentsModule {}

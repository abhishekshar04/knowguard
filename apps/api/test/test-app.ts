import 'reflect-metadata';

import { randomBytes, randomUUID } from 'node:crypto';

import { apiEnvSchema, parseEnv } from '@knowguard/validation';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/common/prisma.service';

/** `overrides` replace environment values (e.g. enable the reranker for search tests). */
export async function createTestApp(
  overrides: Record<string, string> = {},
): Promise<{ app: INestApplication; prisma: PrismaService }> {
  const env = parseEnv(apiEnvSchema, {
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: process.env.TEST_DATABASE_URL,
    TRUST_PROXY: 'loopback',
    // Tests use their own bucket (created on boot) and a small upload limit.
    STORAGE_BUCKET: `${process.env.STORAGE_BUCKET ?? 'knowguard-documents'}-test`,
    STORAGE_AUTO_CREATE_BUCKET: 'true',
    MAX_UPLOAD_MB: '2',
    // Never share queues with a dev worker on the same Redis.
    QUEUE_PREFIX: 'knowguard-test',
    // The 283 MB reranker only loads where it is exercised (search tests pass an override).
    RERANKER_MODEL: 'none',
    // Never call a real model from tests, even when OPENAI_API_KEY is set (AI tests opt into "fake").
    AI_PROVIDER: 'none',
    ...overrides,
  });
  const moduleRef = await Test.createTestingModule({ imports: [AppModule.forRoot(env)] }).compile();
  const app = moduleRef.createNestApplication({ bodyParser: false, logger: false });
  configureApp(app, env);
  await app.init();
  return { app, prisma: app.get(PrismaService) };
}

/** A unique client IP per call, so Redis rate-limit counters never collide across tests/runs. */
export function randomIp(): string {
  const [a, b, c] = randomBytes(3);
  return `10.${a}.${b}.${c}`;
}

export function uniqueEmail(label = 'user'): string {
  return `${label}-${randomUUID().slice(0, 12)}@e2e.example`;
}

import 'reflect-metadata';

import { randomBytes, randomUUID } from 'node:crypto';

import { apiEnvSchema, parseEnv } from '@knowguard/validation';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/common/prisma.service';

export async function createTestApp(): Promise<{ app: INestApplication; prisma: PrismaService }> {
  const env = parseEnv(apiEnvSchema, {
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: process.env.TEST_DATABASE_URL,
    TRUST_PROXY: 'loopback',
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

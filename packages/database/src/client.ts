import { PrismaClient } from '@prisma/client';

export interface CreatePrismaClientOptions {
  /** Overrides DATABASE_URL (used by tests to target the test database). */
  url?: string;
  logQueries?: boolean;
}

export function createPrismaClient({
  url,
  logQueries = false,
}: CreatePrismaClientOptions = {}): PrismaClient {
  return new PrismaClient({
    ...(url ? { datasourceUrl: url } : {}),
    log: logQueries ? ['query', 'warn', 'error'] : ['warn', 'error'],
  });
}

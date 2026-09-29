/**
 * Integration tests: run against a real PostgreSQL (TEST_DATABASE_URL).
 * Prepare with `pnpm --filter @knowguard/database db:test:prepare`.
 * @type {import('jest').Config}
 */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.int-spec.ts'],
  testTimeout: 30_000,
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }] },
};

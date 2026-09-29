/**
 * End-to-end tests: boot the real Nest app against PostgreSQL (TEST_DATABASE_URL) and Redis.
 * @type {import('jest').Config}
 */
module.exports = {
  rootDir: '..',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.e2e-spec.ts'],
  testTimeout: 30_000,
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }] },
};

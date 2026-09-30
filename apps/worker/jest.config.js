/**
 * Unit (*.spec.ts) and integration (*.int-spec.ts) tests. Uses the ONNX-compatible environment
 * for the embedding model; `--experimental-vm-modules` (set in the package scripts) lets pdf.js
 * load its ES-module bundle inside Jest's VM.
 * @type {import('jest').Config}
 */
module.exports = {
  testEnvironment: '<rootDir>/../../tooling/jest/onnx-environment.js',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testMatch: ['**/*.spec.ts', '**/*.int-spec.ts'],
  testTimeout: 120_000,
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }] },
};

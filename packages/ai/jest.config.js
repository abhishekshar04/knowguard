/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: '<rootDir>/../../tooling/jest/onnx-environment.js',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.spec.ts'],
  testTimeout: 120_000,
  transform: { '^.+\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }] },
};

import { defineConfig, devices } from '@playwright/test';

/**
 * Browser tests run the BUILT apps in production mode (Secure "__Host-" cookies, no dev
 * overlays) on dedicated ports, against the test database — never the dev database.
 * Run `pnpm build` first. Environment comes from the repo-root .env (see package script) or CI.
 */
const API_PORT = 4100;
const WEB_PORT = 3100;
const WEB_URL = `http://localhost:${WEB_PORT}`;
const API_URL = `http://localhost:${API_PORT}`;
/** A second web server whose API is unreachable, for testing degraded behaviour. */
export const OFFLINE_WEB_PORT = 3101;
const UNREACHABLE_API_URL = 'http://localhost:9'; // discard port; nothing listens there

/** Isolated from any dev stack sharing the same Redis and object store. */
const QUEUE_PREFIX = 'knowguard-browser-test';
const TEST_BUCKET = `${process.env.STORAGE_BUCKET ?? 'knowguard-documents'}-test`;

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) throw new Error('TEST_DATABASE_URL must be set for browser tests');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  // Server actions and API round trips run against four local servers plus GPU-emulated WebGL
  // pages in parallel; 10s keeps assertions robust under that load without hiding real failures.
  expect: { timeout: 10_000 },
  // Multi-step journeys (invite, sign in, act as two users) take ~12s on an idle machine but up
  // to ~3x that on a loaded laptop or a small CI runner; 60s leaves headroom without hiding hangs.
  timeout: 60_000,
  use: {
    baseURL: WEB_URL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node ../api/dist/main.js',
      url: `${API_URL}/api/v1/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        ...(process.env as Record<string, string>),
        NODE_ENV: 'production',
        API_PORT: String(API_PORT),
        DATABASE_URL: testDatabaseUrl,
        LOG_LEVEL: 'warn',
        STORAGE_BUCKET: TEST_BUCKET,
        STORAGE_AUTO_CREATE_BUCKET: 'true',
        QUEUE_PREFIX,
        // Never call a real model (or spend its quota) from tests, even if OPENAI_API_KEY is set.
        AI_PROVIDER: 'fake',
      },
    },
    {
      // The ingestion worker has no HTTP port: it is ready once it logs "Worker ready".
      command: 'node ../worker/dist/main.js',
      wait: { stdout: /Worker ready/ },
      reuseExistingServer: false,
      timeout: 180_000, // first run may download the embedding model
      env: {
        ...(process.env as Record<string, string>),
        NODE_ENV: 'production',
        DATABASE_URL: testDatabaseUrl,
        LOG_LEVEL: 'info',
        STORAGE_BUCKET: TEST_BUCKET,
        QUEUE_PREFIX,
      },
    },
    {
      command: `pnpm exec next start --port ${WEB_PORT}`,
      url: `${WEB_URL}/login`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        ...(process.env as Record<string, string>),
        NODE_ENV: 'production',
        API_URL,
      },
    },
    {
      command: `pnpm exec next start --port ${OFFLINE_WEB_PORT}`,
      url: `http://localhost:${OFFLINE_WEB_PORT}/login`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        ...(process.env as Record<string, string>),
        NODE_ENV: 'production',
        API_URL: UNREACHABLE_API_URL,
      },
    },
  ],
});

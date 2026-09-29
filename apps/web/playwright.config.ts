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

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) throw new Error('TEST_DATABASE_URL must be set for browser tests');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
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
  ],
});

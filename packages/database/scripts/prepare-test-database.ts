/**
 * Applies all pending migrations to the test database (TEST_DATABASE_URL).
 *
 * Non-destructive by design: integration tests create uniquely-named tenants and delete
 * them afterwards, so the database never needs wiping. Refuses to run against anything
 * that doesn't look like a dedicated test database.
 */
import { execFileSync } from 'node:child_process';

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('TEST_DATABASE_URL is not set. See .env.example');

const databaseName = new URL(url).pathname.replace(/^\//, '');
if (!/test/i.test(databaseName)) {
  throw new Error(`Refusing to migrate "${databaseName}": test database names must contain "test"`);
}

execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: url },
  shell: process.platform === 'win32',
});

/**
 * Fails if the database schema differs from prisma/schema.prisma (after all migrations ran).
 * Catches hand-written migrations that don't match the schema, and raw-SQL objects Prisma would
 * try to drop on the next `migrate dev` (ADR 0010). Uses DATABASE_URL.
 */
import { execFileSync } from 'node:child_process';

const output = execFileSync(
  'pnpm',
  [
    'exec',
    'prisma',
    'migrate',
    'diff',
    '--from-schema-datasource',
    'prisma/schema.prisma',
    '--to-schema-datamodel',
    'prisma/schema.prisma',
    '--script',
  ],
  { encoding: 'utf8', shell: process.platform === 'win32', stdio: ['ignore', 'pipe', 'inherit'] },
);
const statements = output
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('--'));
if (statements.length > 0) {
  // eslint-disable-next-line no-console -- CLI output
  console.error(`Schema drift detected:\n${output}`);
  process.exit(1);
}
// eslint-disable-next-line no-console -- CLI output
console.log('No schema drift.');

#!/usr/bin/env node
/**
 * Fails if the browser bundle (.next/static) contains server-side configuration: the names of
 * server-only environment variables (a sign that server code was bundled for the client), the
 * actual values of secret variables, or anything shaped like a credential. Run after `next build`
 * (`pnpm --filter @knowguard/web check:bundle`; CI runs it). See ADR 0013.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const STATIC_DIR = new URL('../.next/static/', import.meta.url);

/** Server-only configuration. None of these names may appear in code shipped to browsers. */
const SERVER_ONLY = [
  'API_URL',
  'DATABASE_URL',
  'TEST_DATABASE_URL',
  'REDIS_URL',
  'STORAGE_ACCESS_KEY_ID',
  'STORAGE_SECRET_ACCESS_KEY',
  'OPENAI_API_KEY',
  'OPENAI_BASE_URL',
  'SEED_USER_PASSWORD',
  'SESSION_COOKIE_SECURE',
  'POSTGRES_PASSWORD',
  'REDIS_PASSWORD',
];

/** Values that must never reach a browser, when set in the build environment. */
const SECRET_VALUES = [
  'DATABASE_URL',
  'TEST_DATABASE_URL',
  'REDIS_URL',
  'STORAGE_SECRET_ACCESS_KEY',
  'OPENAI_API_KEY',
  'SEED_USER_PASSWORD',
  'POSTGRES_PASSWORD',
  'REDIS_PASSWORD',
]
  .map((name) => [name, process.env[name]])
  .filter(([, value]) => typeof value === 'string' && value.length >= 8);

const CREDENTIAL_SHAPES = [
  /\bsk-(?:proj-|ant-)?[A-Za-z0-9_-]{32,}/,
  /\bAIza[0-9A-Za-z_-]{35}\b/,
  /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\b(?:postgres(?:ql)?|redis|rediss):\/\/[^\s'"]+@/,
];

function* files(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* files(path);
    else if (/\.(js|mjs|css|json|html|map|txt)$/.test(entry)) yield path;
  }
}

let root;
try {
  root = statSync(STATIC_DIR) && STATIC_DIR.pathname.replace(/^\/([A-Za-z]:)/, '$1');
} catch {
  console.error('No .next/static directory: run `next build` first.');
  process.exit(1);
}

const findings = [];
let scanned = 0;
for (const file of files(root)) {
  scanned += 1;
  const text = readFileSync(file, 'utf8');
  const relative = file.slice(root.length);
  for (const name of SERVER_ONLY) {
    if (new RegExp(`\\b${name}\\b`).test(text)) findings.push(`${relative}: mentions server-only ${name}`);
  }
  for (const [name, value] of SECRET_VALUES) {
    if (text.includes(value)) findings.push(`${relative}: contains the value of ${name}`);
  }
  for (const shape of CREDENTIAL_SHAPES) {
    if (shape.test(text)) findings.push(`${relative}: contains something shaped like a credential`);
  }
}

if (scanned === 0) {
  console.error('The browser bundle is empty: run `next build` first.');
  process.exit(1);
}
if (findings.length > 0) {
  console.error('Server-side configuration found in the browser bundle (values are not printed):');
  for (const finding of findings) console.error(`  ${finding}`);
  console.error('\nMove the code that reads it into a server component, server action or route handler.');
  process.exit(1);
}
console.log(`Browser bundle clean: ${scanned} files checked.`);

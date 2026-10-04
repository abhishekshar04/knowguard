#!/usr/bin/env node
/**
 * Fails if any file tracked by git (or staged) contains something that looks like a real
 * credential. Runs in CI and locally: `pnpm security:secrets`. See ADR 0013.
 *
 * Deliberately simple and dependency-free. It catches the common accidents (an API key pasted
 * into code, a .env committed, a private key checked in); it is not a substitute for rotating a
 * key that was ever pushed.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';

const PATTERNS = [
  ['OpenAI API key', /\bsk-(?:proj-|svcacct-|admin-)?[A-Za-z0-9_-]{32,}/],
  ['Anthropic API key', /\bsk-ant-[A-Za-z0-9_-]{32,}/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['AWS access key ID', /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
  ['GitHub token', /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36}\b|\bgithub_pat_[A-Za-z0-9_]{60,}/],
  ['Slack token', /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
  ['Stripe secret key', /\b(?:sk|rk)_live_[A-Za-z0-9]{20,}/],
  ['Private key', /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY( BLOCK)?-----/],
  [
    'Credentials in a URL',
    /\b(?:postgres(?:ql)?|redis|rediss|mongodb(?:\+srv)?|amqp):\/\/[^:\s/'"]+:(?!\$\{|<|\*)[^@\s'"]{8,}@(?!localhost|127\.0\.0\.1|postgres\b|redis\b)/,
  ],
];

/** Files that must never be committed, whatever they contain. */
const FORBIDDEN_FILES = [
  /(^|\/)\.env(\.(?!example$)[^/]+)?$/,
  /\.(pem|p12|pfx|key)$/i,
  /(^|\/)id_(rsa|ed25519|ecdsa)$/,
];

/** Example values in docs and tests that look like secrets but are not. */
const ALLOWED_LINE = /knowguard-secret-scan: allow/;

const MAX_BYTES = 2 * 1024 * 1024;

const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
  encoding: 'utf8',
})
  .split('\0')
  .filter(Boolean);

const findings = [];
for (const file of files) {
  const normalized = file.replace(/\\/g, '/');
  if (FORBIDDEN_FILES.some((pattern) => pattern.test(normalized))) {
    findings.push(`${normalized}: this kind of file must never be committed`);
    continue;
  }
  let text;
  try {
    if (statSync(file).size > MAX_BYTES) continue;
    text = readFileSync(file, 'utf8');
  } catch {
    continue; // deleted in the working tree, or unreadable
  }
  if (text.includes('\0')) continue; // binary
  text.split(/\r?\n/).forEach((line, index) => {
    if (ALLOWED_LINE.test(line)) return;
    for (const [name, pattern] of PATTERNS) {
      if (pattern.test(line)) findings.push(`${normalized}:${index + 1}: possible ${name}`);
    }
  });
}

if (findings.length > 0) {
  console.error('Possible secrets found (values are not printed):');
  for (const finding of findings) console.error(`  ${finding}`);
  console.error(
    '\nRemove them, keep secrets in .env or a secret manager, and rotate any key that was pushed.\n' +
      'For a harmless example value, add the comment "knowguard-secret-scan: allow" on that line.',
  );
  process.exit(1);
}
console.log(`No secrets found in ${files.length} files.`);

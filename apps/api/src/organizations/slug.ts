import { randomBytes } from 'node:crypto';

const MAX_BASE_LENGTH = 50;

/** "Acme Corp, Inc." → "acme-corp-inc". Always returns a valid slug (min 3 chars). */
export function slugify(name: string): string {
  const base = name
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '') // strip accents left by NFKD decomposition
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_BASE_LENGTH)
    .replace(/-+$/g, '');
  return base.length >= 3 ? base : `org-${base || randomSuffix()}`.replace(/-$/, '');
}

export function randomSuffix(): string {
  return randomBytes(4).readUInt32BE().toString(36).padStart(6, '0').slice(-6);
}

/** The preferred slug first, then randomized fallbacks for collisions. */
export function slugCandidates(name: string, attempts = 3): string[] {
  const base = slugify(name);
  return [base, ...Array.from({ length: attempts - 1 }, () => `${base}-${randomSuffix()}`)];
}

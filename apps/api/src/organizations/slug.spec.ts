import { slugSchema } from '@knowguard/validation';

import { slugCandidates, slugify } from './slug';

describe('slugify', () => {
  it.each([
    ['Acme Corp, Inc.', 'acme-corp-inc'],
    ['  Café Déjà Vu  ', 'cafe-deja-vu'],
    ['A', 'org-a'],
    ['日本', expect.stringMatching(/^org-[a-z0-9]{6}$/)],
  ])('%s → %s', (input, expected) => {
    expect(slugify(input)).toEqual(expected);
  });

  it('always produces slugs that pass the shared slug validation', () => {
    for (const name of ['x', '---', 'A very long organization name '.repeat(5), 'Ünïcödé Ltd.', '42']) {
      expect(slugSchema.safeParse(slugify(name)).success).toBe(true);
    }
  });

  it('offers distinct fallback candidates', () => {
    const candidates = slugCandidates('Acme');
    expect(candidates[0]).toBe('acme');
    expect(new Set(candidates).size).toBe(candidates.length);
    for (const candidate of candidates) expect(slugSchema.safeParse(candidate).success).toBe(true);
  });
});

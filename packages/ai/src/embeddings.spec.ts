import { homedir } from 'node:os';
import { join } from 'node:path';

import {
  assertDimensions,
  HashEmbeddingProvider,
  LocalEmbeddingProvider,
  LocalReranker,
  toVectorLiteral,
} from './index';

const dot = (a: number[], b: number[]) => a.reduce((sum, value, i) => sum + value * b[i]!, 0);

describe('embedding helpers', () => {
  it('formats pgvector literals and neutralises non-finite values', () => {
    expect(toVectorLiteral([0.5, -1, 2])).toBe('[0.5,-1,2]');
    expect(toVectorLiteral([Number.NaN, Number.POSITIVE_INFINITY])).toBe('[0,0]');
  });

  it('rejects vectors of the wrong dimension', () => {
    expect(() => assertDimensions([[1, 2]], 384, 'm')).toThrow(/2 dimensions/);
  });

  it('hash provider is deterministic, normalised and 384-dimensional', async () => {
    const provider = new HashEmbeddingProvider();
    const [a, b] = await provider.embedDocuments(['payments deploy', 'payments deploy']);
    expect(a).toHaveLength(384);
    expect(a).toEqual(b);
    expect(Math.hypot(...a!)).toBeCloseTo(1, 6);
  });
});

/**
 * Runs the real local model (downloaded once to the shared cache). Verifies the provider
 * contract the database depends on: 384 normalised dimensions and meaningful similarity.
 */
describe('LocalEmbeddingProvider (real model)', () => {
  const provider = new LocalEmbeddingProvider({
    cacheDir: process.env.EMBEDDING_CACHE_DIR ?? join(homedir(), '.cache', 'knowguard', 'models'),
    allowRemoteModels: true,
  });

  it('produces normalised 384-dimension vectors', async () => {
    const [vector] = await provider.embedDocuments([
      'The payments service is deployed via the release pipeline.',
    ]);
    expect(vector).toHaveLength(384);
    expect(Math.hypot(...vector!)).toBeCloseTo(1, 3);
  });

  it('ranks a relevant passage above an unrelated one for a query', async () => {
    const query = await provider.embedQuery('How do I deploy the payments service?');
    const [relevant, unrelated] = await provider.embedDocuments([
      'Deploying payments: merge to main, then promote the release in the pipeline.',
      'Annual leave: employees receive 25 days of holiday per year.',
    ]);
    expect(dot(query, relevant!)).toBeGreaterThan(dot(query, unrelated!) + 0.1);
  });

  it('batches large inputs', async () => {
    const texts = Array.from({ length: 40 }, (_, i) => `Paragraph number ${i} about topic ${i % 5}.`);
    expect(await provider.embedDocuments(texts)).toHaveLength(40);
  });
});

describe('LocalReranker (real model)', () => {
  const reranker = new LocalReranker({
    cacheDir: process.env.EMBEDDING_CACHE_DIR ?? join(homedir(), '.cache', 'knowguard', 'models'),
    allowRemoteModels: true,
  });

  it('scores the passage that answers the question highest, in [0, 1]', async () => {
    const scores = await reranker.score('How do I roll back a failed payments release?', [
      'Holiday policy: employees receive 25 days of annual leave.',
      'If smoke tests fail, revert the release from the pipeline dashboard within five minutes.',
      'The payments service is deployed by promoting a release in the pipeline.',
    ]);
    expect(scores).toHaveLength(3);
    expect(scores.every((s) => s >= 0 && s <= 1)).toBe(true);
    expect(scores.indexOf(Math.max(...scores))).toBe(1);
  });

  it('returns nothing for no passages', async () => {
    expect(await reranker.score('anything', [])).toEqual([]);
  });
});

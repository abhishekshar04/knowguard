import { createHash } from 'node:crypto';

import { EMBEDDING_DIMENSIONS, type EmbeddingProvider } from './embeddings';

/**
 * Deterministic, model-free embeddings for unit tests of code that only needs *some* stable
 * vectors (bag of hashed words, L2-normalised). Never use for real retrieval.
 */
export class HashEmbeddingProvider implements EmbeddingProvider {
  readonly model = 'test/hash-embedding';
  readonly dimensions = EMBEDDING_DIMENSIONS;

  async embedDocuments(texts: readonly string[]): Promise<number[][]> {
    return texts.map((text) => this.vector(text));
  }

  async embedQuery(text: string): Promise<number[]> {
    return this.vector(text);
  }

  private vector(text: string): number[] {
    const vector = new Array<number>(this.dimensions).fill(0);
    for (const word of text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []) {
      const digest = createHash('sha256').update(word).digest();
      const slot = digest.readUInt16BE(0) % this.dimensions;
      vector[slot] = (vector[slot] ?? 0) + (digest.readUInt8(2) & 1 ? 1 : -1);
    }
    const norm = Math.hypot(...vector) || 1;
    return vector.map((value) => value / norm);
  }
}

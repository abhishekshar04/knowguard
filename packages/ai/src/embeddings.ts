/**
 * Provider-neutral embedding contract. Model-specific code lives in this package only
 * (spec §34: keep AI provider code isolated).
 *
 * Document and query embeddings are separate calls because retrieval models often embed
 * queries differently (e.g. bge uses a query instruction prefix).
 */
export interface EmbeddingProvider {
  /** Stable identifier stored with every chunk, so re-indexing can target stale embeddings. */
  readonly model: string;
  readonly dimensions: number;
  embedDocuments(texts: readonly string[]): Promise<number[][]>;
  embedQuery(text: string): Promise<number[]>;
}

/** The pgvector column is vector(384): the configured model must produce exactly this. */
export const EMBEDDING_DIMENSIONS = 384;

export function assertDimensions(vectors: readonly number[][], expected: number, model: string): void {
  for (const vector of vectors) {
    if (vector.length !== expected) {
      throw new Error(`Embedding model ${model} returned ${vector.length} dimensions; expected ${expected}`);
    }
    if (!vector.every(Number.isFinite)) {
      throw new Error(`Embedding model ${model} returned a non-finite value`);
    }
  }
}

/** pgvector text literal, e.g. "[0.1,0.2]". Numbers only — safe to pass as a query parameter. */
export function toVectorLiteral(vector: readonly number[]): string {
  return `[${vector.map((value) => (Number.isFinite(value) ? value : 0)).join(',')}]`;
}

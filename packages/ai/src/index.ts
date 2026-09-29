/**
 * Provider-neutral AI contracts. Provider-specific adapters are implemented in Phase 6/8
 * and must stay inside this package so the rest of the system never imports a vendor SDK.
 */
export interface EmbeddingProvider {
  readonly model: string;
  readonly dimensions: number;
  embed(texts: readonly string[]): Promise<number[][]>;
}

import { env, type FeatureExtractionPipeline, pipeline } from '@huggingface/transformers';

import { assertDimensions, EMBEDDING_DIMENSIONS, type EmbeddingProvider } from './embeddings';

export const DEFAULT_EMBEDDING_MODEL = 'Xenova/bge-small-en-v1.5';

/** bge models embed queries with this instruction; documents are embedded as-is. */
const BGE_QUERY_INSTRUCTION = 'Represent this sentence for searching relevant passages: ';

export interface LocalEmbeddingConfig {
  model?: string;
  /** Where model files are cached. Shared by all processes on the host. */
  cacheDir: string;
  /**
   * Download models from the Hugging Face Hub if missing. Set false in production after
   * pre-provisioning the cache, so no network access is needed or possible.
   */
  allowRemoteModels: boolean;
  batchSize?: number;
}

/**
 * Runs the embedding model in-process (ONNX Runtime via transformers.js). Document text never
 * leaves the host. The model loads lazily on first use and is shared by all calls.
 */
export class LocalEmbeddingProvider implements EmbeddingProvider {
  readonly model: string;
  readonly dimensions = EMBEDDING_DIMENSIONS;
  private readonly batchSize: number;
  private extractor: Promise<FeatureExtractionPipeline> | null = null;

  constructor(private readonly config: LocalEmbeddingConfig) {
    this.model = config.model ?? DEFAULT_EMBEDDING_MODEL;
    this.batchSize = config.batchSize ?? 16;
  }

  async embedDocuments(texts: readonly string[]): Promise<number[][]> {
    const vectors: number[][] = [];
    for (let i = 0; i < texts.length; i += this.batchSize) {
      vectors.push(...(await this.embed(texts.slice(i, i + this.batchSize))));
    }
    return vectors;
  }

  async embedQuery(text: string): Promise<number[]> {
    const prefix = this.model.toLowerCase().includes('bge') ? BGE_QUERY_INSTRUCTION : '';
    const [vector] = await this.embed([`${prefix}${text}`]);
    if (!vector) throw new Error('Embedding model returned no vector');
    return vector;
  }

  /** Loads the model now (e.g. at worker startup) instead of on the first job. */
  async warmUp(): Promise<void> {
    await this.load();
  }

  private async embed(texts: readonly string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const extractor = await this.load();
    // CLS pooling + L2 normalisation is the bge recipe; cosine similarity = dot product.
    const output = await extractor([...texts], { pooling: 'cls', normalize: true });
    const vectors = output.tolist() as number[][];
    assertDimensions(vectors, this.dimensions, this.model);
    return vectors;
  }

  private load(): Promise<FeatureExtractionPipeline> {
    if (!this.extractor) {
      env.cacheDir = this.config.cacheDir;
      env.allowRemoteModels = this.config.allowRemoteModels;
      env.allowLocalModels = true;
      this.extractor = pipeline('feature-extraction', this.model, { dtype: 'q8' }).catch((error: unknown) => {
        this.extractor = null; // allow a retry on the next call
        throw error;
      }) as Promise<FeatureExtractionPipeline>;
    }
    return this.extractor;
  }
}

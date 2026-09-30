import {
  AutoModelForSequenceClassification,
  AutoTokenizer,
  env,
  type PreTrainedModel,
  type PreTrainedTokenizer,
} from '@huggingface/transformers';

/**
 * Scores (query, passage) pairs jointly — more precise than comparing embeddings, used to
 * reorder the top candidates of a search (spec §21 "merge and rerank").
 */
export interface Reranker {
  readonly model: string;
  /** Relevance in [0, 1] per passage, in input order. */
  score(query: string, passages: readonly string[]): Promise<number[]>;
}

/**
 * bge-reranker-base won a small in-house evaluation (MRR 1.000 vs 0.889 for embeddings alone and
 * 0.917 / 0.889 for smaller cross-encoders); see ADR 0010. Runs locally like the embeddings.
 */
export const DEFAULT_RERANKER_MODEL = 'Xenova/bge-reranker-base';

export interface LocalRerankerConfig {
  model?: string;
  cacheDir: string;
  allowRemoteModels: boolean;
  batchSize?: number;
}

export class LocalReranker implements Reranker {
  readonly model: string;
  private readonly batchSize: number;
  private loaded: Promise<{ tokenizer: PreTrainedTokenizer; classifier: PreTrainedModel }> | null = null;

  constructor(private readonly config: LocalRerankerConfig) {
    this.model = config.model ?? DEFAULT_RERANKER_MODEL;
    this.batchSize = config.batchSize ?? 16;
  }

  async warmUp(): Promise<void> {
    await this.load();
  }

  async score(query: string, passages: readonly string[]): Promise<number[]> {
    if (passages.length === 0) return [];
    const { tokenizer, classifier } = await this.load();
    const scores: number[] = [];
    for (let i = 0; i < passages.length; i += this.batchSize) {
      const batch = passages.slice(i, i + this.batchSize);
      const inputs = tokenizer(new Array<string>(batch.length).fill(query), {
        text_pair: [...batch],
        padding: true,
        truncation: true,
      });
      const { logits } = (await classifier(inputs)) as { logits: { data: ArrayLike<number> } };
      for (const logit of Array.from(logits.data)) scores.push(1 / (1 + Math.exp(-logit)));
    }
    if (scores.length !== passages.length) throw new Error('Reranker returned the wrong number of scores');
    return scores;
  }

  private load() {
    if (!this.loaded) {
      env.cacheDir = this.config.cacheDir;
      env.allowRemoteModels = this.config.allowRemoteModels;
      env.allowLocalModels = true;
      this.loaded = Promise.all([
        AutoTokenizer.from_pretrained(this.model),
        AutoModelForSequenceClassification.from_pretrained(this.model, { dtype: 'q8' }),
      ])
        .then(([tokenizer, classifier]) => ({ tokenizer, classifier }))
        .catch((error: unknown) => {
          this.loaded = null;
          throw error;
        });
    }
    return this.loaded;
  }
}

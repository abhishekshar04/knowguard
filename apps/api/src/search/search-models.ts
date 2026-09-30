import { homedir } from 'node:os';
import { join } from 'node:path';

import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { type EmbeddingProvider, LocalEmbeddingProvider, LocalReranker, type Reranker } from '@knowguard/ai';

import { API_ENV, type ApiEnv } from '../config/api-env';

/**
 * The local models used at query time: the same embedding model the worker indexed with (so
 * query and document vectors are comparable), and an optional cross-encoder reranker.
 */
@Injectable()
export class SearchModels implements OnApplicationBootstrap {
  private readonly logger = new Logger(SearchModels.name);
  readonly embeddings: EmbeddingProvider & { warmUp(): Promise<void> };
  readonly reranker: (Reranker & { warmUp(): Promise<void> }) | null;

  constructor(@Inject(API_ENV) env: ApiEnv) {
    const cacheDir = env.EMBEDDING_CACHE_DIR ?? join(homedir(), '.cache', 'knowguard', 'models');
    this.embeddings = new LocalEmbeddingProvider({
      model: env.EMBEDDING_MODEL,
      cacheDir,
      allowRemoteModels: env.EMBEDDING_ALLOW_REMOTE_MODELS,
    });
    this.reranker =
      env.RERANKER_MODEL === 'none'
        ? null
        : new LocalReranker({
            model: env.RERANKER_MODEL,
            cacheDir,
            allowRemoteModels: env.EMBEDDING_ALLOW_REMOTE_MODELS,
          });
  }

  /** Loads models in the background so the first search is fast; boot is not blocked. */
  onApplicationBootstrap(): void {
    void Promise.all([this.embeddings.warmUp(), this.reranker?.warmUp()])
      .then(() =>
        this.logger.log(
          `Search models ready (${this.embeddings.model}, ${this.reranker?.model ?? 'no reranker'})`,
        ),
      )
      .catch((error: unknown) =>
        this.logger.error(`Search model warm-up failed: ${(error as Error).message}`),
      );
  }
}

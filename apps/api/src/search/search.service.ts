import { Injectable, Logger } from '@nestjs/common';
import { toVectorLiteral } from '@knowguard/ai';
import { authorize } from '@knowguard/authorization';
import { protectedDocumentSelect, readableDocumentsWhere, toProtectedResource } from '@knowguard/database';
import type { SearchResponse } from '@knowguard/types';
import type { SearchRequest } from '@knowguard/validation';

import { type AuthContext, toAuthorizationContext } from '../auth/auth-context';
import { PrismaService } from '../common/prisma.service';
import { type RateLimitRule, RateLimiterService } from '../common/rate-limiter.service';
import { normalizeRrf, reciprocalRankFusion } from './fusion';
import { SearchModels } from './search-models';

/** Candidates taken from each retriever before fusion. */
const CANDIDATES_PER_RETRIEVER = 40;
/** Fused candidates the cross-encoder reranks (≈0.4 s on a laptop CPU for bge-reranker-base). */
const RERANK_CANDIDATES = 20;
/** Searches embed the query and run a cross-encoder: bound per-user cost. */
const SEARCH_RATE_LIMIT: RateLimitRule = { limit: 60, windowSeconds: 60 };

/** An authorized passage, as used by search results and AI context. */
export interface RetrievedPassage {
  chunkId: string;
  documentId: string;
  versionId: string;
  version: number;
  title: string;
  content: string;
  snippet: string;
  page: number | null;
  section: string | null;
  /** Reranker relevance in [0, 1] (normalised RRF when reranking is off). */
  score: number;
}

interface Candidate {
  id: string;
  document_id: string;
}

interface ChunkRow {
  id: string;
  document_id: string;
  version_id: string;
  content: string;
  metadata: { pageNumber?: number | null; section?: string | null } | null;
  snippet: string;
}

/**
 * Permission-aware hybrid search (spec §20–22).
 *
 * Authorization happens BEFORE retrieval: candidate chunks are drawn only from documents that
 * pass readableDocumentsWhere — the query-level twin of the authorization engine, proven
 * equivalent by a randomized database test (ADR 0008). Each final result is then re-checked with
 * authorize() as defense in depth. Unauthorized chunks are never scored, reranked or returned.
 *
 * Pipeline: permission filter → keyword (full-text) + vector (pgvector) retrieval → Reciprocal
 * Rank Fusion → cross-encoder rerank → best passage per document → snippets.
 */
@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly models: SearchModels,
    private readonly rateLimiter: RateLimiterService,
  ) {}

  async search(auth: AuthContext, request: SearchRequest): Promise<SearchResponse> {
    await this.rateLimiter.consume(`search:user:${auth.userId}`, SEARCH_RATE_LIMIT);
    const passages = await this.retrieve(auth, request.query, {
      maxPassages: request.limit,
      maxPerDocument: 1,
    });
    return {
      query: request.query,
      results: passages.map((p) => ({
        documentId: p.documentId,
        title: p.title,
        snippet: p.snippet,
        score: Math.round(p.score * 1000) / 1000,
        page: p.page,
        section: p.section,
        chunkId: p.chunkId,
        versionId: p.versionId,
        version: p.version,
      })),
    };
  }

  /**
   * IDs of READY documents the caller may read — the only documents retrieval may touch.
   * `restrictTo` narrows further (e.g. "Ask AI about this document"); it can never widen.
   */
  async readableDocumentIds(auth: AuthContext, restrictTo?: readonly string[]): Promise<string[]> {
    const readable = await this.prisma.document.findMany({
      where: {
        AND: [
          readableDocumentsWhere(toAuthorizationContext(auth)),
          { status: 'READY' },
          ...(restrictTo ? [{ id: { in: [...restrictTo] } }] : []),
        ],
      },
      select: { id: true },
    });
    return readable.map((d) => d.id);
  }

  /**
   * Permission-aware hybrid retrieval shared by search and Ask AI: permission filter → keyword +
   * vector → RRF → rerank → at most `maxPerDocument` passages per document → final engine check.
   */
  async retrieve(
    auth: AuthContext,
    query: string,
    options: { maxPassages: number; maxPerDocument: number; restrictTo?: readonly string[] },
  ): Promise<RetrievedPassage[]> {
    const context = toAuthorizationContext(auth);

    // 1. Authorization first: the only documents retrieval may touch.
    const documentIds = await this.readableDocumentIds(auth, options.restrictTo);
    if (documentIds.length === 0) return [];

    // 2. Retrieve from both indexes, restricted to those documents and this tenant.
    const queryVector = toVectorLiteral(await this.models.embeddings.embedQuery(query));
    const [vectorHits, keywordHits] = await Promise.all([
      this.vectorCandidates(auth.organizationId, documentIds, queryVector),
      this.keywordCandidates(auth.organizationId, documentIds, query),
    ]);

    // 3. Fuse, then rerank the head of the list with the cross-encoder.
    const fused = reciprocalRankFusion([vectorHits.map((c) => c.id), keywordHits.map((c) => c.id)]);
    const head = [...fused.entries()].sort((a, b) => b[1] - a[1]).slice(0, RERANK_CANDIDATES);
    if (head.length === 0) return [];
    const chunks = await this.loadChunks(
      auth.organizationId,
      head.map(([id]) => id),
      query,
    );
    const scored = await this.rank(query, head, chunks);

    // 4. Cap passages per document and overall.
    const perDocument = new Map<string, number>();
    const top: Array<{ chunk: ChunkRow; score: number }> = [];
    for (const item of scored) {
      const count = perDocument.get(item.chunk.document_id) ?? 0;
      if (count >= options.maxPerDocument) continue;
      perDocument.set(item.chunk.document_id, count + 1);
      top.push(item);
      if (top.length >= options.maxPassages) break;
    }

    // 5. Final engine check on every document before anything leaves this method.
    const documents = await this.prisma.document.findMany({
      where: { id: { in: [...perDocument.keys()] }, organizationId: auth.organizationId },
      select: { id: true, title: true, currentVersion: true, ...protectedDocumentSelect },
    });
    const byId = new Map(documents.map((d) => [d.id, d]));
    const passages: RetrievedPassage[] = [];
    for (const { chunk, score } of top) {
      const doc = byId.get(chunk.document_id);
      if (!doc || !authorize(context, 'READ', toProtectedResource(doc)).allowed) {
        // Should be impossible (the filter is proven equivalent); never return it, and make noise.
        this.logger.error(
          `Retrieved chunk of document ${chunk.document_id} failed the final authorization check`,
        );
        continue;
      }
      passages.push({
        chunkId: chunk.id,
        documentId: doc.id,
        versionId: chunk.version_id,
        version: doc.currentVersion,
        title: doc.title,
        content: chunk.content,
        snippet: chunk.snippet,
        page: chunk.metadata?.pageNumber ?? null,
        section: chunk.metadata?.section ?? null,
        score,
      });
    }
    return passages;
  }

  /** Nearest neighbours by cosine distance (HNSW; iterative scan keeps filtered results full). */
  private async vectorCandidates(
    organizationId: string,
    documentIds: string[],
    vector: string,
  ): Promise<Candidate[]> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL hnsw.iterative_scan = relaxed_order`;
      return tx.$queryRaw<Candidate[]>`
        SELECT id, document_id FROM document_chunks
        WHERE organization_id = ${organizationId}::uuid
          AND document_id = ANY(${documentIds}::uuid[])
          AND embedding IS NOT NULL
        ORDER BY embedding <=> ${vector}::vector
        LIMIT ${CANDIDATES_PER_RETRIEVER}`;
    });
  }

  /**
   * Full-text match on the stemmed English index (natural language) OR the exact-token index
   * (IDs, error codes, names). Query words are OR-ed — questions rarely contain every word of
   * the answer — and ts_rank_cd rewards passages matching more of them.
   */
  private async keywordCandidates(
    organizationId: string,
    documentIds: string[],
    query: string,
  ): Promise<Candidate[]> {
    return this.prisma.$queryRaw<Candidate[]>`
      WITH q AS (
        SELECT
          to_tsquery('english', coalesce((SELECT string_agg(quote_literal(l), ' | ')
            FROM unnest(tsvector_to_array(to_tsvector('english', ${query}))) AS l), '')) AS en,
          to_tsquery('simple', coalesce((SELECT string_agg(quote_literal(l), ' | ')
            FROM unnest(tsvector_to_array(to_tsvector('simple', ${query}))) AS l), '')) AS si
      )
      SELECT c.id, c.document_id
      FROM document_chunks c, q
      WHERE c.organization_id = ${organizationId}::uuid
        AND c.document_id = ANY(${documentIds}::uuid[])
        AND (to_tsvector('english', c.content) @@ q.en OR to_tsvector('simple', c.content) @@ q.si)
      ORDER BY ts_rank_cd(to_tsvector('english', c.content), q.en)
             + ts_rank_cd(to_tsvector('simple', c.content), q.si) DESC
      LIMIT ${CANDIDATES_PER_RETRIEVER}`;
  }

  /** Candidate chunks with a query-focused plain-text snippet (no markup: never rendered as HTML). */
  private async loadChunks(
    organizationId: string,
    ids: string[],
    query: string,
  ): Promise<Map<string, ChunkRow>> {
    const rows = await this.prisma.$queryRaw<ChunkRow[]>`
      WITH q AS (
        SELECT to_tsquery('english', coalesce((SELECT string_agg(quote_literal(l), ' | ')
          FROM unnest(tsvector_to_array(to_tsvector('english', ${query}))) AS l), '')) AS en
      )
      SELECT c.id, c.document_id, c.version_id, c.content, c.metadata,
        ts_headline('english', c.content, q.en,
          'StartSel="", StopSel="", MaxWords=40, MinWords=20, MaxFragments=2, FragmentDelimiter=" … "') AS snippet
      FROM document_chunks c, q
      WHERE c.organization_id = ${organizationId}::uuid AND c.id = ANY(${ids}::uuid[])`;
    return new Map(rows.map((row) => [row.id, row]));
  }

  /** Reranker scores when available; otherwise normalised RRF. */
  private async rank(
    query: string,
    head: Array<[string, number]>,
    chunks: Map<string, ChunkRow>,
  ): Promise<Array<{ chunk: ChunkRow; score: number }>> {
    const items = head
      .map(([id, rrf]) => ({ chunk: chunks.get(id), rrf }))
      .filter((item): item is { chunk: ChunkRow; rrf: number } => item.chunk !== undefined);

    if (this.models.reranker) {
      try {
        const scores = await this.models.reranker.score(
          query,
          items.map((item) => `${item.chunk.metadata?.section ?? ''}\n${item.chunk.content}`.trim()),
        );
        return items
          .map((item, i) => ({ chunk: item.chunk, score: scores[i] ?? 0 }))
          .sort((a, b) => b.score - a.score);
      } catch (error) {
        this.logger.warn(`Reranking failed, using fused order: ${(error as Error).message}`);
      }
    }
    return items.map((item) => ({ chunk: item.chunk, score: normalizeRrf(item.rrf, 2) }));
  }
}

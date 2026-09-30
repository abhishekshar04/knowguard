# ADR 0010 — Permission-aware hybrid search

**Status:** Accepted (Phase 7)

## Authorization first (spec §2, §20)

`POST /api/v1/search` (requires `document.read`; a POST so queries stay out of URLs and logs) works in this order:

1. **Candidate documents:** `readableDocumentsWhere(context)` AND `status = READY`. This is the query-level twin of the authorization engine, proven equivalent by a randomized database test (ADR 0008).
2. **Retrieval** runs **only** over chunks of those documents, with an explicit `organization_id` filter as well. Unauthorized chunks are never scored, reranked, fused or returned.
3. **Defense in depth:** each final result is re-checked with `authorize(context, 'READ', document)`. A failure there would mean the filter disagrees with the engine, so the result is dropped and an error is logged.

The candidate set is passed as `document_id = ANY($ids)`. That's simple, exact, and fine at current scale. For organizations with very large numbers of documents, Phase 10 will move the filter into SQL (a join mirroring `readableDocumentsWhere`), guarded by the same equivalence test.

## Retrieval and ranking

| Stage   | How                                                                                                                                                                                                                                                                     |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Keyword | PostgreSQL full-text search on two GIN expression indexes: `english` (stemmed, natural language) and `simple` (exact tokens such as `ERR-4012`, names and IDs). Query words are OR-ed (questions rarely contain every word of the answer) and ranked with `ts_rank_cd`. |
| Vector  | pgvector cosine distance on an HNSW index, using the same local embedding model as ingestion (bge-small, with bge's query instruction). `hnsw.iterative_scan = relaxed_order` keeps filtered queries from returning too few rows.                                       |
| Fusion  | Reciprocal Rank Fusion (k = 60) over the top 40 from each retriever; no score calibration needed.                                                                                                                                                                       |
| Rerank  | A local cross-encoder, **bge-reranker-base** (q8, about 283 MB), scores the top 20 fused candidates in about 0.4 s on a laptop CPU. `RERANKER_MODEL=none` disables it, falling back to fused order. If reranking fails at runtime, fused order is used.                 |
| Results | The best passage per document, up to `limit` (1–50). Each result has a plain-text snippet from `ts_headline`, a score in [0, 1], page, section, chunk, version and version number.                                                                                      |

### Why this reranker, and a known weakness

Evaluation on 14 passages and 20 queries, including paraphrases and word-overlap traps, measuring mean reciprocal rank (MRR) and how often the correct passage ranked first:

| Strategy                      | MRR       | Correct passage ranked first |
| ----------------------------- | --------- | ---------------------------- |
| Vector only                   | 0.875     | 16/20                        |
| Keyword + vector (RRF)        | 0.829     | 14/20                        |
| **RRF + bge-reranker-base**   | **0.898** | **17/20**                    |
| 50/50 blend of rerank and RRF | 0.879     | 16/20                        |

Earlier, smaller probes rejected `ms-marco-MiniLM-L-6-v2` and `mxbai-rerank-xsmall-v1`.

The reranker is best overall but not always right. For _"How do I undo a bad payments release?"_, it prefers the "deploy payments" passage over the "revert the release" passage, because it over-weights shared words. The **correct document is still ranked first**; only the passage chosen within it differs. The evaluation is small. A labelled, larger, organization-specific evaluation set is the right next step before tuning further.

## Indexes and schema drift

Prisma's schema language can't express full-text expression indexes or HNSW indexes, so they live in raw SQL (`20261001100000_search_indexes`). Prisma ignores expression indexes, but it tried to **drop** a plain HNSW column index on the next diff. Making HNSW **partial** (`WHERE embedding IS NOT NULL`, which is correct anyway) makes Prisma ignore it too.

A new check, `pnpm db:check-drift`, fails if the database and `schema.prisma` differ after migrations. It runs in CI, so a future `migrate dev` can't silently drop search indexes.

## Web

The Search page submits through a server action (POST), not a GET form, so queries never appear in URLs, browser history or access logs. Highlighting splits plain text into React text nodes; document content is never rendered as HTML.

## Operational notes

- The API loads the embedding model and reranker in the background at startup (the first search waits if they're not ready). This adds about 400 MB of memory to the API process.
- Search is rate-limited to 60 per user per minute, because each search embeds the query and runs a cross-encoder.
- Only the active version of a document has chunks (ADR 0009), so older versions never appear in results.

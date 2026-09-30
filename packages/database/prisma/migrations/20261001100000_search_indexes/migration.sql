-- Search indexes (Phase 7). Prisma's schema language cannot express these, so they live in raw
-- SQL; see ADR 0010 for how drift checks treat them.

-- Keyword search: stemmed English (natural language) and exact tokens ('simple': IDs, error
-- codes, names — no stemming, no stop words).
CREATE INDEX "document_chunks_fts_english_idx"
  ON "document_chunks" USING GIN (to_tsvector('english', "content"));
CREATE INDEX "document_chunks_fts_simple_idx"
  ON "document_chunks" USING GIN (to_tsvector('simple', "content"));

-- Vector search: approximate nearest neighbours by cosine distance. Partial (only rows that
-- have an embedding) — which also keeps Prisma from treating it as schema drift.
CREATE INDEX "document_chunks_embedding_hnsw_idx"
  ON "document_chunks" USING hnsw ("embedding" vector_cosine_ops)
  WHERE "embedding" IS NOT NULL;

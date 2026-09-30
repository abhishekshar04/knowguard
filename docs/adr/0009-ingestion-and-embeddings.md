# ADR 0009 — Ingestion pipeline and local embeddings

**Status:** Accepted (Phase 6)

## Embedding model: local, in-process

- **Decision (chosen by the product owner):** embeddings are computed **inside the worker** with `Xenova/bge-small-en-v1.5` (ONNX Runtime via transformers.js, 8-bit quantized, 384 dimensions, CLS pooling, L2-normalized). **Document text never leaves our infrastructure.** There is no API key or per-use cost, and the model is about 35 MB.
- Queries use bge's instruction prefix (`Represent this sentence for searching relevant passages: `); documents are embedded without it. On a smoke test, "How do I deploy the payments service?" scored 0.80 against the relevant passage and 0.53 against an unrelated one.
- The model is cached in `EMBEDDING_CACHE_DIR` (default `~/.cache/knowguard/models`). Set `EMBEDDING_ALLOW_REMOTE_MODELS=false` in production after pre-provisioning the cache, so the worker needs no outbound network access. The worker loads the model at startup, so a missing model fails fast.
- All model-specific code lives in `packages/ai` (`EmbeddingProvider`, `LocalEmbeddingProvider`). The API will reuse it for query embeddings in Phase 7.
- **The dimension is fixed in the schema** (`vector(384)`). Changing models means a migration plus re-embedding everything (`REINDEX_DOCUMENT`). Every chunk records its `embedding_model`, so stale chunks can be found.

## Pipeline (spec §17)

The API enqueues `PROCESS_DOCUMENT {organizationId, documentId, versionId}` on upload. `REINDEX_DOCUMENT` (via `POST /documents/:id/reindex`, which requires WRITE) re-runs the same handler. The spec's intermediate jobs (`EXTRACT_TEXT`, `GENERATE_EMBEDDINGS`, `INDEX_DOCUMENT`) are **stages within one idempotent job** rather than separate queue hops: splitting them would add hand-offs and partial states without any benefit at this scale. The document's status reflects the stage: `PROCESSING` (download, extract, chunk) → `INDEXING` (embed, store) → `READY` or `FAILED`.

- **Tenant-safe:** the job payload isn't trusted. Organization, document and version must match the database, so a forged or stale job can't touch another tenant's document (tested).
- **Active version only (spec §14):** a superseded version is skipped. The final write happens in a transaction that locks the document row (`SELECT … FOR UPDATE`) and re-checks `current_version_id`, so a slow old job can never overwrite a newer version's chunks. Writing replaces **all** of the document's chunks.
- **Idempotent:** re-running produces the same chunk set, never duplicates.
- **Failures:** unsupported, corrupt, empty or oversized content raises a non-retryable `IngestionError` (BullMQ `UnrecoverableError`), and the document is marked `FAILED` immediately. Transient errors (storage, database) retry with exponential backoff (5 attempts), and `FAILED` is written only on the last attempt. `processing_error` is **user-facing**: only messages written for users are stored; other errors become a generic message, and details go to worker logs.
- **Queue isolation:** `QUEUE_PREFIX` namespaces BullMQ keys, so dev, test, CI and browser-test workers sharing one Redis never consume each other's jobs.

## Extraction (untrusted input)

| Format   | How                              | Structure kept                                    |
| -------- | -------------------------------- | ------------------------------------------------- |
| PDF      | unpdf (pdf.js 6.1), page by page | page numbers                                      |
| DOCX     | mammoth → semantic HTML → blocks | headings (Word styles), paragraphs, lists, tables |
| Markdown | own parser                       | ATX and setext headings, fenced code, lists       |
| Text     | blank-line paragraphs            | —                                                 |

Hardening:

- **pdf.js:** the bundled build contains no `eval` / `new Function` font path (verified), so the CVE-2024-4367 class of font exploits doesn't apply. System fonts and font-face injection are also disabled.
- **DOCX zip bombs:** the ZIP central directory is checked before anything is inflated (at most 100 MB uncompressed, a 200× ratio and 5,000 entries).
- **Limits:** 5 M extracted characters, 2,000 PDF pages, 10,000 chunks.
- **Normalization:** NFKC, control characters stripped, PDF end-of-line hyphenation joined.
- **Scanned PDFs** without a text layer fail with a clear message; OCR is out of scope.

## Chunking (spec §19)

`SectionChunker` implements a replaceable `Chunker` interface:

- A heading always ends the current chunk, so chunks never span sections.
- Paragraphs stay whole when they fit (about 320 target and 450 maximum estimated tokens, inside the model's 512-token limit). Otherwise they're split at sentence boundaries, and only at word boundaries as a last resort. Code and tables split at line boundaries and never receive prose overlap.
- About 48 tokens of trailing context overlap into the next chunk of the same section.
- Each chunk records `headingPath`, `heading`, `section`, `pageStart`/`pageEnd` and `pageNumber` (spec §18), plus the document, version and tenant.
- The embedding input is `title + section + content`, so a vector carries its context. `content` is stored clean for citations.

## Schema

`document_chunks(id, organization_id, document_id, version_id, chunk_index, content, token_count, metadata jsonb, embedding vector(384), embedding_model)`. It has composite tenant foreign keys to the document and version (`ON DELETE CASCADE`, so deleting a document removes its chunks) and a unique `(version_id, chunk_index)`. The migration enables the `vector` extension.

**Deferred to Phase 7 (search):**

- an ANN index (HNSW) and a keyword `tsvector` index, chosen together with the permission-filtered query plan;
- a job that sweeps orphaned objects left by a crash mid-upload (ADR 0008).

## Testing notes

- The real model runs in unit, integration and browser tests. CI caches it in `~/.cache/knowguard/models`.
- Jest needs `tooling/jest/onnx-environment.js`, which gives ONNX Runtime the host's typed arrays, plus `--experimental-vm-modules` for pdf.js's ES-module bundle. Production Node needs neither.

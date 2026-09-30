# ADR 0008 — Documents, storage and query-level access control

**Status:** Accepted (Phase 5)

## Data model

- **`documents`** holds tenant-owned metadata. `owner_id` is a composite foreign key to the owner's **membership**, so an owner must belong to the document's organization. Current-version fields (`current_version_id`, `mime_type`, `size`, `storage_key`) are denormalized for listing.
- **`document_versions`** are **immutable**: every upload is a new row with its SHA-256 `content_hash`, and rows are never updated. Ingestion (Phase 6) processes the active version only.
- **`document_audiences`** hold the role, team or department IDs for ROLE/TEAM/DEPARTMENT visibility. Which kind of ID applies follows from `documents.visibility`.
- **`document_permissions`** are the ACL entries from spec §13, plus an **`effect` column (ALLOW/DENY)** so the engine's explicit denies can be stored. There is one entry per (subject, permission), which rules out ambiguous ALLOW+DENY pairs.
- Audience and ACL subjects are polymorphic, so they have no foreign keys. The application validates that subjects exist **in the caller's organization**, and deleting a team, department or role removes the entries that reference it.

## Storage

- Original files live in S3-compatible storage under `organizations/{org}/documents/{doc}/{version}/original.{ext}` (spec §15). The key builder validates every segment, so a key can't escape its tenant prefix. PostgreSQL stores metadata only.
- `@knowguard/storage` defines a provider-neutral `ObjectStorage` interface. `S3ObjectStorage` is the only file that imports the AWS SDK.
- Uploads are sent with a SHA-256 checksum, and the store rejects corrupted bodies.
- **Local development and CI use SeaweedFS** (Apache-2.0), pinned to `4.48`. MinIO stopped publishing container images, so it's no longer a practical local default. SeaweedFS is configured with credentials, so anonymous requests are refused, matching production S3.

## Upload flow (spec §16)

Authenticate → capability `document.create` → Multer in memory, bounded by `MAX_UPLOAD_MB` → type detection **from the bytes** (PDF signature; DOCX = ZIP containing `word/document.xml`; UTF-8 text without NUL bytes) → SHA-256 → store the object → create document + version 1 + audience in one transaction (on failure, the object is deleted) → enqueue `PROCESS_DOCUMENT` → return details.

- Clients' Content-Type and filenames are not trusted. The stored extension comes from detection, and download filenames are sanitized.
- The ingestion job ID is `process-{versionId}`, so re-enqueuing is a no-op. The worker doesn't consume the queue until Phase 6 registers handlers, so jobs wait rather than failing.
- Remaining gap: if the process dies between storing the object and committing the transaction, an orphaned object is left behind. It's unreferenced and tenant-prefixed; a sweeper job belongs to Phase 6.

## Access rules

Every endpoint applies the Phase 4 engine (ADR 0007):

| Operation                       | Capability gate   | Engine action                       |
| ------------------------------- | ----------------- | ----------------------------------- |
| list, view, download            | `document.read`   | READ (list uses the SQL twin below) |
| edit metadata, upload a version | `document.update` | WRITE                               |
| visibility, ACL                 | `document.share`  | SHARE                               |
| delete                          | `document.delete` | DELETE                              |

- **Disclosure:** if the caller can't READ a document, it returns **404, byte-identical to a missing document**, so titles and existence never leak. Readable but not permitted for the action gives **403 `DOCUMENT_ACCESS_DENIED`**.
- **Sharing without escalation:** an ALLOW entry may only grant an action the caller can perform on that document (`GRANT_EXCEEDS_YOUR_ACCESS`). DENY entries are always allowed. ACLs are only returned to callers who may SHARE.
- **Downloads** stream API → BFF → browser with `nosniff`, `private, no-store`, and a strict CSP. Text is served inside a CSP **sandbox**. Only PDF and text can be opened inline; everything else downloads.

## Query-level twin of the engine

`readableDocumentsWhere(context)` (packages/database) translates the engine's READ evaluation into a Prisma/SQL filter for listing. Search and RAG will reuse it in Phases 7–8. **A randomized database test proves it returns exactly the documents `authorize(context, 'READ', doc)` allows**: 60 rounds, up to 12 documents with random visibility, audiences and ACLs, 4 callers each, across two tenants. A deliberate mutation (honouring ALLOW entries on PRIVATE documents, which would be a leak) is caught.

## Deferred

- **Row-level security:** still deferred (ADR 0007). The equivalence test and the per-request engine are the enforcement today.
- **Admin documents page:** administrators have no bypass (ADR 0007), so they manage documents through the same pages as everyone else.
- **Malware scanning of uploads:** out of scope. Files are never executed or served as active content.

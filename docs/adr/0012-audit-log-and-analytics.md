# ADR 0012 — Audit log and analytics

**Status:** Accepted (Phase 9)

## What is recorded (spec §28)

Each record holds: organization, acting user (null for system actions), action, resource type and ID, result (`SUCCESS`, `DENIED` or `FAILURE`), small metadata, client IP, user agent and time.

| Action                                                                               | When                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DOCUMENT_VIEW`                                                                      | Opening a document, including the on-page preview. Repeated views by the same user within 5 minutes count as one (Redis; without Redis, every view is recorded).                                                                                                                                                                                                                                                                                                                                     |
| `DOCUMENT_DOWNLOAD`                                                                  | Any download of the file or one of its versions.                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `DOCUMENT_CREATE` / `DOCUMENT_UPDATE` / `DOCUMENT_DELETE`                            | Upload. Then each change, labelled `change`: `DETAILS` (title or description edited), `NEW_VERSION` or `REINDEX`. Then deletion.                                                                                                                                                                                                                                                                                                                                                                     |
| `DOCUMENT_SHARE`                                                                     | Visibility or audience changed (before → after).                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `PERMISSION_CHANGE`                                                                  | A document's ACL replaced (before → after), or a role created, changed or deleted (permissions added and removed).                                                                                                                                                                                                                                                                                                                                                                                   |
| `USER_CREATED`, `USER_INVITED`, `USER_SUSPENDED`, `USER_REACTIVATED`, `ROLE_CHANGED` | Joining (by registration or invitation), invitations (never the link), suspension changes, and a member's roles (before → after).                                                                                                                                                                                                                                                                                                                                                                    |
| `GROUP_CHANGED`                                                                      | A team or department created, renamed or deleted, or a member added or removed. These change who inherits access, so they are audited too.                                                                                                                                                                                                                                                                                                                                                           |
| `LOGIN`, `LOGIN_FAILED`                                                              | `LOGIN_FAILED` is recorded only for known accounts with an active membership; an unknown email has no organization to attribute it to. It is written **without awaiting**, so a known email answers no slower than an unknown one (login stays timing-safe, ADR 0005).                                                                                                                                                                                                                               |
| `ACCESS_DENIED`                                                                      | Every refusal: a missing capability (recorded in the global guard, with the permissions required), a 403 from a management or escalation rule (recorded by an interceptor, with the error code and route), and refusals hidden behind a 404, such as a document the user may not read, another member's conversation or "Ask AI" about an unreadable document. Hidden refusals are recorded only when the resource exists in the caller's organization. The caller still receives the identical 404. |
| `SEARCH`, `AI_QUERY`                                                                 | Result counts, and for Ask AI: outcome (`ANSWERED`, `NO_ANSWER` or `FAILED`), model, token usage and the IDs of the documents it cited.                                                                                                                                                                                                                                                                                                                                                              |

**Never recorded:**

- passwords, session or invitation tokens, API keys;
- document content, search queries, AI questions and answers;
- conversation titles, which are the user's first question.

A sanitiser enforces this as a safety net. It redacts any metadata key whose last word names a secret or free text, such as `password`, `sessionToken`, `apiKey`, `question` or `query`. Counters such as `promptTokens` are kept. It also bounds depth, string length, array length and total size (4 KB).

## Append-only, enforced by the database

A trigger rejects:

- every `UPDATE` on `audit_logs`;
- every `DELETE` and `TRUNCATE`, unless the transaction has run `SET LOCAL knowguard.audit_purge = 'on'`.

`purgeAuditLogs()` in `packages/database` is the only code that sets it. It exists for retention and test cleanup.

Records have no foreign key to users, so they survive the people they describe. Records belong to an organization through a restrictive foreign key, so an organization's history must be purged deliberately before the organization can be deleted.

## Write semantics

The API records an event after the operation commits, or after the refusal is decided. A failed audit write is logged as an error for operators and does not fail the user's request.

This is a deliberate trade-off. A transactional outbox, which writes in the same transaction as the change, would remove the small window where a change commits and its record does not. That remains an option if a compliance regime requires it.

The request's IP and user agent come from AsyncLocalStorage, set by a middleware after Express "trust proxy" resolves the client IP. Services therefore don't have to pass the request around.

## Reading (requires `audit.read`)

`GET /api/v1/audit-logs` filters by action, result, resource, user and time range. It returns newest first and pages with a cursor (`cursor` = last ID).

It is always scoped to the caller's organization: filtering by another tenant's user or resource returns nothing.

Labels are resolved **with the viewer's own access**:

- **Documents:** a document's title appears only if the reviewer can read that document. Holding `audit.read` therefore never reveals the names of private documents. Admins in particular cannot read other people's private documents (ADR 0007).
- **Conversations:** titles are never shown.
- **Users, roles, teams and departments:** shown by name.

Denials of `audit.read` are themselves audited.

## Analytics (requires `audit.read`)

`GET /api/v1/analytics/overview?days=7|30|90` combines current state from the live tables with activity from the audit log:

- **Members:** active, invited and suspended.
- **Documents:** counts by status, storage and chunks.
- **Daily activity** (UTC days): searches, AI questions, views, downloads, uploads, denials.
- **Ask AI:** outcomes and tokens.
- **Most used documents:** views plus AI citations, with titles hidden as above.
- **Most active members.**

The UI shows one small single-series bar chart per metric, each on its own scale; no dual axes and no colour-coded series. Each bar has a hover and keyboard-focus tooltip, and a table view lists the same numbers.

## Consequences

- Document page previews now use `GET /documents/:id/preview`, which returns at most 64 KB of text documents. A preview is therefore recorded as a view rather than a full download.
- `/admin/documents` lists only documents the administrator can read, with status and title filters (`GET /documents?status=&q=`). It never lists other members' private documents.
- **Retention:** records are kept indefinitely. Organizations needing a retention period can run `purgeAuditLogs()` from a scheduled job. Built-in retention settings are future work, as is export (CSV or SIEM streaming).

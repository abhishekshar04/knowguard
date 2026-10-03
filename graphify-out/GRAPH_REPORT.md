# Graph Report - knowguard  (2026-10-02)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 2591 nodes · 6139 edges · 140 communities (128 shown, 12 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 185 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `0137961a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- bootstrap.ts
- 20260929114255_init/migration.sql
- engine.property.spec.ts
- search-view.tsx
- Card
- auth.service.spec.ts
- document-access.int-spec.ts
- types/src/index.ts
- structure.service.ts
- ai/src/index.ts
- ai.service.ts
- getSessionToken
- AuditService
- ask/page.tsx
- packages_types_dist_index
- ApiException
- CurrentAuth
- session.ts
- members.service.ts
- api/package.json
- documents.service.ts
- ConversationsService
- actorOf
- admin/actions.ts
- chunker.ts
- tasks
- organizations.controller.ts
- logger/package.json
- audit.controller.ts
- StructureService
- @nestjs/common
- IngestionError
- documents.ts
- organization.ts
- storage/package.json
- helpers.ts
- compilerOptions
- compilerOptions
- ingestion.int-spec.ts
- audit.e2e-spec.ts
- api/tsconfig.build.json
- scripts
- dependencies
- validation/package.json
- app-sidebar.tsx
- components.json
- database/package.json
- ai/package.json
- InvitationsService
- AuthContext
- DepartmentsController
- database/src/index.ts
- search.service.ts
- package.json
- auth/package.json
- web/package.json
- env.ts
- auth.service.ts
- process-document.ts
- types/package.json
- Decisions
- audit/page.tsx
- devDependencies
- FakeChatProvider
- authorization/package.json
- LocalEmbeddingProvider
- database/tsconfig.json
- compilerOptions
- worker/package.json
- devDependencies
- 20260930120000_documents/migration.sql
- roles.ts
- s3-object-storage.int-spec.ts
- analytics/page.tsx
- ADR 0005 — Identity, membership, sessions and the BFF
- PrismaService
- dependencies
- compilerOptions
- ai/tsconfig.build.json
- auth/tsconfig.build.json
- authorization/tsconfig.build.json
- worker/tsconfig.build.json
- database/tsconfig.build.json
- logger/tsconfig.build.json
- storage/src/index.ts
- storage/tsconfig.build.json
- types/tsconfig.build.json
- validation/tsconfig.build.json
- scripts
- session-policy.ts
- health.controller.ts
- ADR 0009 — Ingestion pipeline and local embeddings
- ADR 0008 — Documents, storage and query-level access control
- README.md
- RolesService
- audit.service.ts
- ai/tsconfig.json
- auth/tsconfig.json
- authorization/tsconfig.json
- check-drift.ts
- logger/tsconfig.json
- storage/tsconfig.json
- types/tsconfig.json
- validation/tsconfig.json
- nest-cli.json
- ObjectStorage
- S3ObjectStorage
- onnx-environment.js
- devDependencies
- Security rules that must hold
- ADR 0010 — Permission-aware hybrid search
- KnowGuard — guide for AI assistants
- scripts
- devDependencies
- 20261002090000_audit_log/migration.sql
- .prettierrc.json
- devDependencies
- postcss.config.mjs
- ADR 0003 — Tenant isolation enforced in the schema
- "user_organizations"
- LocalReranker
- next.config.ts
- AGENTS.md
- api/src/main.ts
- dependencies
- ADR 0011 — Ask AI: grounded answers from authorized passages
- api-exception.filter.ts
- primitives.ts
- scripts
- "document_chunks"
- scripts
- ConversationDetails
- DocumentDetails
- validation/src/audit.ts
- "conversations"
- "invitations"
- web/eslint.config.mjs

## God Nodes (most connected - your core abstractions)
1. `AuthContext` - 124 edges
2. `@nestjs/common` - 70 edges
3. `CurrentAuth` - 58 edges
4. `getSessionToken()` - 54 edges
5. `ApiException` - 51 edges
6. `PrismaService` - 51 edges
7. `RequirePermission()` - 51 edges
8. `Card()` - 47 edges
9. `apiRequest()` - 44 edges
10. `CardContent()` - 41 edges

## Surprising Connections (you probably didn't know these)
- `Authentication in the API` --references--> `SessionAuthGuard`  [INFERRED]
  docs/adr/0005-identity-membership-and-sessions.md → apps/api/src/auth/session-auth.guard.ts
- `Capability checks: `@RequirePermission()`` --references--> `SessionAuthGuard`  [INFERRED]
  docs/adr/0006-rbac-invitations-and-organization-structure.md → apps/api/src/auth/session-auth.guard.ts
- `API errors` --references--> `ApiException`  [INFERRED]
  docs/adr/0004-credentials-and-errors.md → apps/api/src/common/api-exception.ts
- `Pipeline (spec §17)` --references--> `IngestionError`  [INFERRED]
  docs/adr/0009-ingestion-and-embeddings.md → apps/worker/src/ingestion/blocks.ts
- `Tenant scoping` --references--> `ParseIdPipe`  [INFERRED]
  docs/adr/0006-rbac-invitations-and-organization-structure.md → apps/api/src/common/parse-id.pipe.ts

## Import Cycles
- None detected.

## Communities (140 total, 12 thin omitted)

### Community 0 - "bootstrap.ts"
Cohesion: 0.22
Nodes (10): configureApp(), parseTrustProxy(), currentRequestMeta(), requestContextMiddleware(), storage, createUntrustedForwardingDetector(), requestFrom(), TrustFn (+2 more)

### Community 1 - "20260929114255_init/migration.sql"
Cohesion: 0.14
Nodes (29): "department_memberships", department_memberships_organization_id_idx, department_memberships_user_id_idx, "departments", departments_id_organization_id_key, departments_organization_id_name_key, "organizations", organizations_slug_key (+21 more)

### Community 2 - "engine.property.spec.ts"
Cohesion: 0.06
Nodes (41): Decision: one pure engine, Evaluation order (first match wins), Phase 5 obligation: query-level equivalence, Semantics we chose (the spec leaves these open), Verification, authorize(), deny(), inheritsRead() (+33 more)

### Community 3 - "search-view.tsx"
Cohesion: 0.38
Nodes (6): searchAction(), SearchState, escapeRegExp(), Highlight(), highlightTerms(), SearchView()

### Community 4 - "Card"
Cohesion: 0.16
Nodes (46): DepartmentsPage(), metadata, AdminDocumentsPage(), metadata, PermissionsPage(), metadata, RoleCard(), RoleFields() (+38 more)

### Community 5 - "auth.service.spec.ts"
Cohesion: 0.10
Nodes (6): AuthController, AuthService, meta, setup(), StoredUser, { verifyPassword }

### Community 6 - "document-access.int-spec.ts"
Cohesion: 0.10
Nodes (16): Authorization happens before the prompt exists (spec §2, §23), aclSubjectMatches(), ProtectedDocumentRow, protectedDocumentSelect, readableDocumentsWhere(), toProtectedResource(), aclEntry, contextSpec (+8 more)

### Community 7 - "types/src/index.ts"
Cohesion: 0.03
Nodes (57): AclEntryView, AclSubjectTypeValue, AiSource, AiStatusResponse, AiStreamEvent, AiUsage, AnalyticsDay, AnalyticsOverview (+49 more)

### Community 8 - "structure.service.ts"
Cohesion: 0.07
Nodes (12): ParseIdPipe, ZodValidationPipe, memberId, roleId, departmentId, memberId, departmentSelect, MemberLinks (+4 more)

### Community 9 - "ai/src/index.ts"
Cohesion: 0.32
Nodes (8): ChatErrorKind, ChatMessage, ChatUsage, assertDimensions(), EMBEDDING_DIMENSIONS, toVectorLiteral(), DEFAULT_EMBEDDING_MODEL, LocalEmbeddingConfig

### Community 10 - "ai.service.ts"
Cohesion: 0.05
Nodes (30): conversationId, NO_ANSWER, ORGANIZATION_RATE_LIMIT, PreparedAnswer, PROVIDER_ERROR_CODES, relevantPassages(), toClientError(), toSource() (+22 more)

### Community 11 - "getSessionToken"
Cohesion: 0.14
Nodes (35): deleteConversationAction(), error(), POST(), addAclEntryAction(), audienceIds(), currentEntries(), deleteDocumentAction(), documentPath() (+27 more)

### Community 12 - "AuditService"
Cohesion: 0.10
Nodes (7): AccessDeniedInterceptor, AuditService, SessionService, RateLimiterService, ExecResult, limiterWith(), rule

### Community 13 - "ask/page.tsx"
Cohesion: 0.12
Nodes (28): AskPage(), loadOrNull(), metadata, DashboardPage(), dynamic, metadata, StatusRow(), Action (+20 more)

### Community 14 - "packages_types_dist_index"
Cohesion: 0.12
Nodes (18): metadata, one(), Params, STATUSES, Detail(), DocumentPage(), loadDocument(), metadata (+10 more)

### Community 15 - "ApiException"
Cohesion: 0.14
Nodes (17): endpointMetadata(), markAudited(), recorded, AuthenticatedRequest, IS_PUBLIC_KEY, REQUIRE_VERIFIED_EMAIL_KEY, SessionAuthGuard, setup() (+9 more)

### Community 16 - "CurrentAuth"
Cohesion: 0.08
Nodes (6): CurrentAuth, RequirePermission(), attachment(), DocumentsController, UploadedFileInput, TeamsController

### Community 17 - "session.ts"
Cohesion: 0.10
Nodes (34): acceptInvitationAction(), AuthFormState, capitalize(), field(), fieldErrorsFrom(), loginAction(), logoutAction(), messageFor() (+26 more)

### Community 18 - "members.service.ts"
Cohesion: 0.10
Nodes (18): canGrantRoles(), canManageMember(), isSubset(), MANAGEMENT_DENIAL_MESSAGES, ManagementVerdict, OWNERSHIP_PERMISSION, Principal, ADMIN (+10 more)

### Community 19 - "api/package.json"
Cohesion: 0.08
Nodes (23): bullmq, dotenv-cli, ioredis, jest, @knowguard/ai, @knowguard/auth, @knowguard/authorization, @knowguard/database (+15 more)

### Community 20 - "documents.service.ts"
Cohesion: 0.05
Nodes (17): IngestionQueue, documentId, versionId, accessDenied(), AUDIENCE_TYPE, DocumentRow, InspectedUpload, PREVIEW_TYPES (+9 more)

### Community 21 - "ConversationsService"
Cohesion: 0.09
Nodes (7): AiController, AiService, retrievalQuery(), ConversationsService, toSources(), toView(), What is recorded (spec §28)

### Community 22 - "actorOf"
Cohesion: 0.17
Nodes (4): actorOf(), toAuthorizationContext(), notFound(), DocumentsService

### Community 23 - "admin/actions.ts"
Cohesion: 0.23
Nodes (26): addDepartmentMemberAction(), addTeamMemberAction(), call(), createDepartmentAction(), createRoleAction(), createTeamAction(), deleteDepartmentAction(), deleteRoleAction() (+18 more)

### Community 24 - "chunker.ts"
Cohesion: 0.15
Nodes (15): Chunker, ChunkMetadata, ChunkOptions, DEFAULT_CHUNK_OPTIONS, DraftChunk, estimateTokens(), join(), Piece (+7 more)

### Community 25 - "tasks"
Cohesion: 0.09
Nodes (22): dependsOn, outputs, cache, dependsOn, persistent, globalDependencies, globalPassThroughEnv, dependsOn (+14 more)

### Community 26 - "organizations.controller.ts"
Cohesion: 0.15
Nodes (5): OrganizationsController, OrganizationsService, randomSuffix(), slugCandidates(), slugify()

### Community 27 - "logger/package.json"
Cohesion: 0.09
Nodes (19): dependencies, pino, pino-pretty, devDependencies, exports, files, main, name (+11 more)

### Community 28 - "audit.controller.ts"
Cohesion: 0.09
Nodes (6): ACTIVITY_FIELDS, AnalyticsService, utcDate(), AuditController, AuditLogService, AuditRow

### Community 29 - "StructureService"
Cohesion: 0.20
Nodes (4): isUniqueViolation(), nameTaken(), StructureService, toMemberRefs()

### Community 30 - "@nestjs/common"
Cohesion: 0.10
Nodes (13): AiModule, AuditModule, AuthModule, InfrastructureModule, DocumentsModule, HealthModule, InvitationsModule, MembersModule (+5 more)

### Community 31 - "IngestionError"
Cohesion: 0.28
Nodes (16): assertWithinLimit(), flattenParagraph(), IngestionError, MAX_EXTRACTED_CHARS, normalizeText(), TextBlock, decodeUtf8(), assertSafeZip() (+8 more)

### Community 32 - "documents.ts"
Cohesion: 0.12
Nodes (16): AclEntryInput, aclEntrySchema, CreateDocumentInput, createDocumentSchema, description, idList, ListDocumentsQuery, listDocumentsQuerySchema (+8 more)

### Community 33 - "organization.ts"
Cohesion: 0.12
Nodes (19): AcceptInvitationInput, acceptInvitationSchema, CreateDepartmentInput, createDepartmentSchema, CreateTeamInput, createTeamSchema, description, InviteMemberInput (+11 more)

### Community 34 - "storage/package.json"
Cohesion: 0.13
Nodes (14): dependencies, @aws-sdk/client-s3, exports, files, dotenv-cli, jest, ts-jest, @types/jest (+6 more)

### Community 35 - "helpers.ts"
Cohesion: 0.27
Nodes (12): inviteEmployee(), isolateClientIp(), loginViaUi(), PASSWORD, registerViaUi(), SESSION_COOKIE, signOut(), uniqueEmail() (+4 more)

### Community 36 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 37 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, declaration, declarationMap, esModuleInterop, exactOptionalPropertyTypes, forceConsistentCasingInFileNames, isolatedModules, lib (+11 more)

### Community 38 - "ingestion.int-spec.ts"
Cohesion: 0.09
Nodes (9): JobRegistry, logger, main(), chunker, embeddings, GUIDE, logger, orgs (+1 more)

### Community 39 - "audit.e2e-spec.ts"
Cohesion: 0.09
Nodes (27): ADR-0012, createdOrgIds, createdUserIds, http(), login(), me(), register(), createIndexer() (+19 more)

### Community 40 - "api/tsconfig.build.json"
Cohesion: 0.20
Nodes (9): compilerOptions, noEmit, outDir, rootDir, types, exclude, extends, include (+1 more)

### Community 41 - "scripts"
Cohesion: 0.11
Nodes (19): scripts, build, db:check-drift, db:deploy, db:generate, db:migrate, db:reset, db:seed (+11 more)

### Community 42 - "dependencies"
Cohesion: 0.11
Nodes (18): dependencies, bullmq, helmet, ioredis, @knowguard/ai, @knowguard/auth, @knowguard/authorization, @knowguard/database (+10 more)

### Community 43 - "validation/package.json"
Cohesion: 0.08
Nodes (23): dependencies, @knowguard/authorization, zod, devDependencies, jest, ts-jest, @types/jest, exports (+15 more)

### Community 44 - "app-sidebar.tsx"
Cohesion: 0.23
Nodes (13): AppLayout(), AppSidebar(), AppSidebarProps, isActive(), MobileHeader(), NavLink(), NavSection(), ADMIN_NAV (+5 more)

### Community 45 - "components.json"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 46 - "database/package.json"
Cohesion: 0.05
Nodes (40): dependencies, @knowguard/authorization, @prisma/client, devDependencies, dotenv-cli, fast-check, jest, @knowguard/auth (+32 more)

### Community 47 - "ai/package.json"
Cohesion: 0.09
Nodes (22): dependencies, @huggingface/transformers, openai, devDependencies, jest, ts-jest, @types/jest, exports (+14 more)

### Community 48 - "InvitationsService"
Cohesion: 0.09
Nodes (6): emailKey(), invalidCredentials(), uniqueViolationOn(), InvitationsController, invalidInvitation(), InvitationsService

### Community 49 - "AuthContext"
Cohesion: 0.15
Nodes (8): AuthContext, assertOwnershipRemains(), permissionsOf(), roleKeysOf(), MembersController, denied(), effectiveStatus(), MembersService

### Community 51 - "database/src/index.ts"
Cohesion: 0.16
Nodes (14): main(), ORGANIZATION, USERS, createPrismaClient(), CreatePrismaClientOptions, Db, loadPermissionIds(), provisionSystemRoles() (+6 more)

### Community 52 - "search.service.ts"
Cohesion: 0.08
Nodes (10): normalizeRrf(), reciprocalRankFusion(), RRF_K, SearchController, SearchModels, Candidate, ChunkRow, SEARCH_RATE_LIMIT (+2 more)

### Community 53 - "package.json"
Cohesion: 0.15
Nodes (14): description, engines, node, name, packageManager, private, eslint-config-prettier, @eslint/js (+6 more)

### Community 54 - "auth/package.json"
Cohesion: 0.06
Nodes (34): ADR 0004 — Credentials, secrets and API errors, API errors, Passwords, Secrets and logging, Sessions, dependencies, @node-rs/argon2, devDependencies (+26 more)

### Community 55 - "web/package.json"
Cohesion: 0.12
Nodes (15): dotenv-cli, @knowguard/types, @knowguard/validation, name, private, version, clsx, postcss (+7 more)

### Community 56 - "env.ts"
Cohesion: 0.10
Nodes (20): ADR-0009, aiEnvShape, ApiEnv, apiEnvSchema, booleanFlag, embeddingEnvShape, EnvValidationError, logLevel (+12 more)

### Community 57 - "auth.service.ts"
Cohesion: 0.11
Nodes (11): AUTH_RATE_LIMITS, Db, IssuedSession, RoleAssignment, roleIdsOf(), rolesWithPermissionsSelect, RateLimitRule, requestMeta (+3 more)

### Community 59 - "process-document.ts"
Cohesion: 0.26
Nodes (8): createIngestionHandler(), download(), embeddingInput(), IngestionOutcome, markFailed(), processDocument(), setStatus(), JobHandler

### Community 60 - "types/package.json"
Cohesion: 0.14
Nodes (13): dependencies, devDependencies, exports, files, main, name, private, scripts (+5 more)

### Community 61 - "Decisions"
Cohesion: 0.17
Nodes (11): ADR 0006 — Minimal RBAC, invitations and organization structure, Capability checks: `@RequirePermission()`, Context, Decisions, Directory visibility, Invitations (no email provider yet), Not in Phase 3, Organization structure (+3 more)

### Community 62 - "audit/page.tsx"
Cohesion: 0.17
Nodes (11): AuditPage(), filtersFrom(), metadata, one(), Params, ACTION_LABELS, metadataText(), RESOURCE_NAMES (+3 more)

### Community 63 - "devDependencies"
Cohesion: 0.17
Nodes (12): devDependencies, dotenv-cli, express, jest, @nestjs/cli, @nestjs/testing, supertest, ts-jest (+4 more)

### Community 64 - "FakeChatProvider"
Cohesion: 0.18
Nodes (10): Provider isolation (spec §34), ChatProvider, ChatProviderError, ChatRequest, ChatStreamEvent, FakeChatProvider, OpenAIChatConfig, OpenAIChatProvider (+2 more)

### Community 65 - "authorization/package.json"
Cohesion: 0.09
Nodes (22): dependencies, devDependencies, fast-check, jest, ts-jest, @types/jest, exports, files (+14 more)

### Community 66 - "LocalEmbeddingProvider"
Cohesion: 0.27
Nodes (3): Embedding model: local, in-process, EmbeddingProvider, LocalEmbeddingProvider

### Community 67 - "database/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, noEmit, rootDir, types, extends, include, ../../tsconfig.base.json

### Community 68 - "compilerOptions"
Cohesion: 0.13
Nodes (14): compilerOptions, declaration, declarationMap, emitDecoratorMetadata, experimentalDecorators, isolatedModules, module, moduleResolution (+6 more)

### Community 69 - "worker/package.json"
Cohesion: 0.08
Nodes (23): bullmq, dotenv-cli, ioredis, jest, @knowguard/ai, @knowguard/database, @knowguard/logger, @knowguard/storage (+15 more)

### Community 70 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, eslint, eslint-config-prettier, @eslint/js, globals, jest-environment-node, prettier, turbo (+3 more)

### Community 71 - "20260930120000_documents/migration.sql"
Cohesion: 0.26
Nodes (14): "document_audiences", document_audiences_organization_id_target_id_idx, "document_permissions", document_permissions_document_id_subject_type_subject_id_pe_key, document_permissions_organization_id_subject_type_subject_i_idx, "document_versions", document_versions_document_id_version_key, document_versions_id_organization_id_key (+6 more)

### Community 72 - "roles.ts"
Cohesion: 0.27
Nodes (6): CreateRoleInput, createRoleSchema, permissionKeys, roleKeyFromName(), UpdateRoleInput, updateRoleSchema

### Community 73 - "s3-object-storage.int-spec.ts"
Cohesion: 0.31
Nodes (4): documentObjectKey(), documentObjectPrefix(), newKey(), storage

### Community 74 - "analytics/page.tsx"
Cohesion: 0.24
Nodes (10): AnalyticsPage(), metadata, METRICS, pct(), PERIODS, Stat(), ActivityChart(), dayFormat (+2 more)

### Community 75 - "ADR 0005 — Identity, membership, sessions and the BFF"
Cohesion: 0.20
Nodes (9): ADR 0005 — Identity, membership, sessions and the BFF, Authentication in the API, Browser → Next.js BFF → API, Client IP and deployment requirement, Identity and membership, Not yet implemented (tracked), Rate limiting and brute force, Registration (+1 more)

### Community 76 - "PrismaService"
Cohesion: 0.07
Nodes (10): PermissionCatalogSync, PrismaService, RedisService, OBJECT_STORAGE, objectStorageProvider, StorageBootstrap, API_ENV, createDoc() (+2 more)

### Community 77 - "dependencies"
Cohesion: 0.17
Nodes (12): dependencies, class-variance-authority, clsx, @knowguard/types, @knowguard/validation, lucide-react, next, @radix-ui/react-slot (+4 more)

### Community 78 - "compilerOptions"
Cohesion: 0.20
Nodes (9): compilerOptions, declaration, declarationMap, noEmit, rootDir, types, extends, include (+1 more)

### Community 79 - "ai/tsconfig.build.json"
Cohesion: 0.20
Nodes (9): compilerOptions, noEmit, outDir, rootDir, types, exclude, extends, include (+1 more)

### Community 80 - "auth/tsconfig.build.json"
Cohesion: 0.20
Nodes (9): compilerOptions, noEmit, outDir, rootDir, types, exclude, extends, include (+1 more)

### Community 81 - "authorization/tsconfig.build.json"
Cohesion: 0.20
Nodes (9): compilerOptions, noEmit, outDir, rootDir, types, exclude, extends, include (+1 more)

### Community 82 - "worker/tsconfig.build.json"
Cohesion: 0.20
Nodes (9): compilerOptions, noEmit, outDir, rootDir, types, exclude, extends, include (+1 more)

### Community 83 - "database/tsconfig.build.json"
Cohesion: 0.20
Nodes (9): compilerOptions, noEmit, outDir, rootDir, types, exclude, extends, include (+1 more)

### Community 84 - "logger/tsconfig.build.json"
Cohesion: 0.20
Nodes (9): compilerOptions, noEmit, outDir, rootDir, types, exclude, extends, include (+1 more)

### Community 85 - "storage/src/index.ts"
Cohesion: 0.44
Nodes (3): ObjectNotFoundError, StoredObject, S3StorageConfig

### Community 86 - "storage/tsconfig.build.json"
Cohesion: 0.20
Nodes (9): compilerOptions, noEmit, outDir, rootDir, types, exclude, extends, include (+1 more)

### Community 87 - "types/tsconfig.build.json"
Cohesion: 0.20
Nodes (9): compilerOptions, noEmit, outDir, rootDir, types, exclude, extends, include (+1 more)

### Community 88 - "validation/tsconfig.build.json"
Cohesion: 0.20
Nodes (9): compilerOptions, noEmit, outDir, rootDir, types, exclude, extends, include (+1 more)

### Community 89 - "scripts"
Cohesion: 0.25
Nodes (8): scripts, build, dev, lint, start, test, test:e2e, typecheck

### Community 90 - "session-policy.ts"
Cohesion: 0.36
Nodes (5): evaluateSession(), SessionState, SessionVerdict, now, TOUCH_INTERVAL_MS

### Community 91 - "health.controller.ts"
Cohesion: 0.15
Nodes (5): Public(), HealthController, HealthService, probe(), makeService()

### Community 92 - "ADR 0009 — Ingestion pipeline and local embeddings"
Cohesion: 0.24
Nodes (6): ADR 0009 — Ingestion pipeline and local embeddings, Extraction (untrusted input), Pipeline (spec §17), Schema, Testing notes, HashEmbeddingProvider

### Community 93 - "ADR 0008 — Documents, storage and query-level access control"
Cohesion: 0.22
Nodes (7): Access rules, ADR 0008 — Documents, storage and query-level access control, Data model, Deferred, Query-level twin of the engine, Storage, Upload flow (spec §16)

### Community 94 - "README.md"
Cohesion: 0.11
Nodes (14): ADR 0002 — Pinned framework versions, ADR 0007 — Authorization engine and custom roles, Context, Decision: custom roles, Deferred, Architecture decisions, Commands, Deploying: required (+6 more)

### Community 95 - "RolesService"
Cohesion: 0.13
Nodes (3): RolesController, exceedsYourAccess(), RolesService

### Community 96 - "audit.service.ts"
Cohesion: 0.25
Nodes (7): clean(), isSensitiveKey(), sanitizeAuditMetadata(), AuditEvent, enumsMatch, Same, ADR-0012

### Community 97 - "ai/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, noEmit, rootDir, types, extends, include, ../../tsconfig.base.json

### Community 98 - "auth/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, noEmit, rootDir, types, extends, include, ../../tsconfig.base.json

### Community 99 - "authorization/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, noEmit, rootDir, types, extends, include, ../../tsconfig.base.json

### Community 100 - "check-drift.ts"
Cohesion: 0.29
Nodes (4): output, statements, ADR-0010, databaseName

### Community 101 - "logger/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, noEmit, rootDir, types, extends, include, ../../tsconfig.base.json

### Community 102 - "storage/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, noEmit, rootDir, types, extends, include, ../../tsconfig.base.json

### Community 103 - "types/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, noEmit, rootDir, types, extends, include, ../../tsconfig.base.json

### Community 104 - "validation/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, noEmit, rootDir, types, extends, include, ../../tsconfig.base.json

### Community 105 - "nest-cli.json"
Cohesion: 0.33
Nodes (5): compilerOptions, deleteOutDir, tsConfigPath, $schema, sourceRoot

### Community 108 - "onnx-environment.js"
Cohesion: 0.33
Nodes (4): jest-environment-node, OnnxEnvironment, SHARED, { TestEnvironment }

### Community 109 - "devDependencies"
Cohesion: 0.22
Nodes (9): devDependencies, dotenv-cli, eslint-config-next, @playwright/test, postcss, tailwindcss, @tailwindcss/postcss, @types/react (+1 more)

### Community 110 - "Security rules that must hold"
Cohesion: 0.25
Nodes (8): Security rules that must hold, ADR 0012 — Audit log and analytics, Analytics (requires `audit.read`), Append-only, enforced by the database, Consequences, Reading (requires `audit.read`), Write semantics, purgeAuditLogs()

### Community 111 - "ADR 0010 — Permission-aware hybrid search"
Cohesion: 0.25
Nodes (7): ADR 0010 — Permission-aware hybrid search, Authorization first (spec §2, §20), Indexes and schema drift, Operational notes, Retrieval and ranking, Web, Why this reranker, and a known weakness

### Community 112 - "KnowGuard — guide for AI assistants"
Cohesion: 0.17
Nodes (10): auth(), Commands, Gotchas, KnowGuard — guide for AI assistants, Layout, Orientation: use the knowledge graph first, ADR 0001 — Modular monolith, separate worker, internal packages, Consequences (+2 more)

### Community 113 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, lint, test, test:e2e, typecheck

### Community 114 - "devDependencies"
Cohesion: 0.40
Nodes (5): devDependencies, dotenv-cli, jest, ts-jest, @types/jest

### Community 115 - "20261002090000_audit_log/migration.sql"
Cohesion: 0.39
Nodes (7): "audit_logs", audit_logs_no_truncate, audit_logs_no_update_or_delete, audit_logs_organization_id_action_created_at_idx, audit_logs_organization_id_created_at_idx, audit_logs_organization_id_resource_type_resource_id_idx, audit_logs_organization_id_user_id_created_at_idx

### Community 116 - ".prettierrc.json"
Cohesion: 0.40
Nodes (4): printWidth, semi, singleQuote, trailingComma

### Community 117 - "devDependencies"
Cohesion: 0.25
Nodes (8): devDependencies, dotenv-cli, jest, jszip, pdf-lib, ts-jest, tsx, @types/jest

### Community 120 - "ADR 0003 — Tenant isolation enforced in the schema"
Cohesion: 0.40
Nodes (4): ADR 0003 — Tenant isolation enforced in the schema, Consequences, Context, Decision

### Community 121 - ""user_organizations""
Cohesion: 0.46
Nodes (7): "sessions", sessions_expires_at_idx, sessions_token_hash_key, sessions_user_id_revoked_at_idx, "user_organizations", user_organizations_organization_id_status_idx, user_organizations_single_org_per_user_key

### Community 123 - "LocalReranker"
Cohesion: 0.21
Nodes (6): DEFAULT_RERANKER_MODEL, LocalReranker, LocalRerankerConfig, Reranker, ADR-0010, @huggingface/transformers

### Community 126 - "api/src/main.ts"
Cohesion: 0.12
Nodes (6): AppModule, API_PREFIX, PinoNestLogger, main(), @nestjs/platform-express, reflect-metadata

### Community 127 - "dependencies"
Cohesion: 0.18
Nodes (11): dependencies, bullmq, ioredis, @knowguard/ai, @knowguard/database, @knowguard/logger, @knowguard/storage, @knowguard/types (+3 more)

### Community 128 - "ADR 0011 — Ask AI: grounded answers from authorized passages"
Cohesion: 0.20
Nodes (10): ADR 0011 — Ask AI: grounded answers from authorized passages, Citations, Consequences, Conversations, Cost controls, Model choice, Prompt (spec §24–25), Relevance: when not to call the model (+2 more)

### Community 129 - "api-exception.filter.ts"
Cohesion: 0.28
Nodes (4): ApiExceptionFilter, clientErrorStatus(), DEFAULT_CODES, INTERNAL

### Community 130 - "primitives.ts"
Cohesion: 0.16
Nodes (14): AiQueryInput, aiQuerySchema, displayName, LoginInput, loginSchema, RegisterInput, registerSchema, validRegistration (+6 more)

### Community 131 - "scripts"
Cohesion: 0.25
Nodes (8): scripts, build, dev, lint, start, test, test:e2e, typecheck

### Community 132 - ""document_chunks""
Cohesion: 0.39
Nodes (6): "document_chunks", document_chunks_organization_id_document_id_idx, document_chunks_version_id_chunk_index_key, document_chunks_embedding_hnsw_idx, document_chunks_fts_english_idx, document_chunks_fts_simple_idx

### Community 133 - "scripts"
Cohesion: 0.29
Nodes (7): scripts, build, dev, lint, start, test:browser, typecheck

### Community 136 - "validation/src/audit.ts"
Cohesion: 0.38
Nodes (5): AnalyticsQuery, analyticsQuerySchema, AUDIT_ACTIONS, AuditQuery, auditQuerySchema

### Community 137 - ""conversations""
Cohesion: 0.60
Nodes (5): "conversation_messages", conversation_messages_conversation_id_created_at_idx, "conversations", conversations_id_organization_id_key, conversations_organization_id_user_id_updated_at_idx

### Community 138 - ""invitations""
Cohesion: 0.70
Nodes (4): "invitations", invitations_organization_id_idx, invitations_token_hash_key, invitations_user_id_organization_id_idx

## Knowledge Gaps
- **913 isolated node(s):** `TrustFn`, `MessageRow`, `PromptSource`, `Events`, `Entry` (+908 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1172 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AuthContext` connect `AuthContext` to `audit.service.ts`, `.search`, `auth.service.spec.ts`, `structure.service.ts`, `ai.service.ts`, `Security rules that must hold`, `ApiException`, `CurrentAuth`, `members.service.ts`, `DepartmentsController`, `documents.service.ts`, `ConversationsService`, `actorOf`, `search.service.ts`, `auth.service.ts`, `organizations.controller.ts`, `audit.controller.ts`, `RolesService`?**
  _High betweenness centrality (0.079) - this node is a cross-community bridge._
- **Why does `next` connect `session.ts` to `search-view.tsx`, `Card`, `analytics/page.tsx`, `getSessionToken`, `app-sidebar.tsx`, `ask/page.tsx`, `packages_types_dist_index`, `web/package.json`, `admin/actions.ts`, `next.config.ts`, `audit/page.tsx`?**
  _High betweenness centrality (0.066) - this node is a cross-community bridge._
- **Why does `@nestjs/common` connect `@nestjs/common` to `bootstrap.ts`, `api-exception.filter.ts`, `structure.service.ts`, `ai.service.ts`, `ApiException`, `members.service.ts`, `api/package.json`, `documents.service.ts`, `organizations.controller.ts`, `audit.controller.ts`, `ingestion.int-spec.ts`, `audit.e2e-spec.ts`, `DepartmentsController`, `search.service.ts`, `auth.service.ts`, `PrismaService`, `health.controller.ts`, `RolesService`, `audit.service.ts`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **What connects `TrustFn`, `MessageRow`, `PromptSource` to the rest of the system?**
  _913 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `20260929114255_init/migration.sql` be split into smaller, more focused modules?**
  _Cohesion score 0.14022988505747128 - nodes in this community are weakly interconnected._
- **Should `engine.property.spec.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0647307924984876 - nodes in this community are weakly interconnected._
- **Should `auth.service.spec.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.10052910052910052 - nodes in this community are weakly interconnected._
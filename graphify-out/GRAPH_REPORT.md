# Graph Report - knowguard  (2026-10-01)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 2430 nodes · 5505 edges · 136 communities (120 shown, 16 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 143 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9f6e1a44`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- bootstrap.ts
- 20260929114255_init/migration.sql
- engine.ts
- (auth)/actions.ts
- users/page.tsx
- auth.service.spec.ts
- document-access.int-spec.ts
- types/src/index.ts
- structure.service.ts
- ai/src/index.ts
- ai.service.ts
- getSessionToken
- ApiException
- ask/page.tsx
- packages_types_dist_index
- auth-context.ts
- CurrentAuth
- session.ts
- roles.service.ts
- api/package.json
- documents.service.ts
- AuthContext
- DocumentsService
- admin/actions.ts
- chunker.ts
- tasks
- organizations.controller.ts
- logger/package.json
- members.service.ts
- notFound
- @nestjs/common
- IngestionError
- documents.ts
- organization.ts
- storage/package.json
- helpers.ts
- compilerOptions
- compilerOptions
- ingestion.int-spec.ts
- organization-admin.e2e-spec.ts
- api/tsconfig.build.json
- scripts
- dependencies
- validation/package.json
- app-sidebar.tsx
- components.json
- database/package.json
- ai/package.json
- InvitationsService
- MembersService
- DepartmentsController
- documents.e2e-spec.ts
- search.service.ts
- package.json
- auth/package.json
- web/package.json
- env.ts
- auth.service.ts
- SearchService
- process-document.ts
- types/package.json
- Decisions
- auth.ts
- devDependencies
- chat.ts
- authorization/package.json
- LocalEmbeddingProvider
- database/tsconfig.json
- compilerOptions
- worker/package.json
- devDependencies
- TeamsController
- roles.ts
- s3-object-storage.int-spec.ts
- primitives.ts
- ADR 0005 — Identity, membership, sessions and the BFF
- PrismaService
- MembersController
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
- health.service.ts
- ADR 0009 — Ingestion pipeline and local embeddings
- ADR 0008 — Documents, storage and query-level access control
- KnowGuard
- RolesController
- prompt.ts
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
- types.ts
- src/permissions.ts
- ADR 0010 — Permission-aware hybrid search
- KnowGuard — guide for AI assistants
- scripts
- devDependencies
- README.md
- .prettierrc.json
- engine.property.spec.ts
- postcss.config.mjs
- ADR 0003 — Tenant isolation enforced in the schema
- ADR 0007 — Authorization engine and custom roles
- LocalReranker
- next.config.ts
- AGENTS.md
- PinoNestLogger
- dependencies
- ADR 0011 — Ask AI: grounded answers from authorized passages
- api-exception.filter.ts
- zod
- scripts
- engine.spec.ts
- engines
- ConversationDetails
- DocumentDetails

## God Nodes (most connected - your core abstractions)
1. `AuthContext` - 107 edges
2. `@nestjs/common` - 63 edges
3. `CurrentAuth` - 54 edges
4. `ApiException` - 48 edges
5. `RequirePermission()` - 48 edges
6. `getSessionToken()` - 46 edges
7. `PrismaService` - 44 edges
8. `Card()` - 40 edges
9. `apiRequest()` - 38 edges
10. `CardContent()` - 38 edges

## Surprising Connections (you probably didn't know these)
- `API errors` --references--> `ApiException`  [INFERRED]
  docs/adr/0004-credentials-and-errors.md → apps/api/src/common/api-exception.ts
- `Authentication in the API` --references--> `SessionAuthGuard`  [INFERRED]
  docs/adr/0005-identity-membership-and-sessions.md → apps/api/src/auth/session-auth.guard.ts
- `Pipeline (spec §17)` --references--> `IngestionError`  [INFERRED]
  docs/adr/0009-ingestion-and-embeddings.md → apps/worker/src/ingestion/blocks.ts
- `Tenant scoping` --references--> `ParseIdPipe`  [INFERRED]
  docs/adr/0006-rbac-invitations-and-organization-structure.md → apps/api/src/common/parse-id.pipe.ts
- `Browser → Next.js BFF → API` --references--> `requireUser()`  [INFERRED]
  docs/adr/0005-identity-membership-and-sessions.md → apps/web/lib/session.ts

## Import Cycles
- None detected.

## Communities (136 total, 16 thin omitted)

### Community 0 - "bootstrap.ts"
Cohesion: 0.33
Nodes (7): configureApp(), parseTrustProxy(), createUntrustedForwardingDetector(), requestFrom(), TrustFn, express, helmet

### Community 1 - "20260929114255_init/migration.sql"
Cohesion: 0.06
Nodes (65): "department_memberships", department_memberships_organization_id_idx, department_memberships_user_id_idx, "departments", departments_id_organization_id_key, departments_organization_id_name_key, "organizations", organizations_slug_key (+57 more)

### Community 2 - "engine.ts"
Cohesion: 0.23
Nodes (12): Decision: one pure engine, Evaluation order (first match wins), Phase 5 obligation: query-level equivalence, Semantics we chose (the spec leaves these open), Verification, authorize(), deny(), inheritsRead() (+4 more)

### Community 3 - "(auth)/actions.ts"
Cohesion: 0.15
Nodes (27): searchAction(), SearchState, acceptInvitationAction(), AuthFormState, capitalize(), field(), fieldErrorsFrom(), loginAction() (+19 more)

### Community 4 - "users/page.tsx"
Cohesion: 0.16
Nodes (47): DepartmentsPage(), metadata, PermissionsPage(), metadata, RoleCard(), RoleFields(), RolesPage(), AdminTeamsPage() (+39 more)

### Community 5 - "auth.service.spec.ts"
Cohesion: 0.10
Nodes (7): AuthController, Public(), AuthService, meta, setup(), StoredUser, { verifyPassword }

### Community 6 - "document-access.int-spec.ts"
Cohesion: 0.06
Nodes (34): ADMIN, EMPLOYEE, MANAGER, OWNER, Authorization happens before the prompt exists (spec §2, §23), main(), ORGANIZATION, USERS (+26 more)

### Community 7 - "types/src/index.ts"
Cohesion: 0.04
Nodes (46): AclEntryView, AclSubjectTypeValue, AiSource, AiStatusResponse, AiStreamEvent, AiUsage, ApiErrorBody, ConversationListResponse (+38 more)

### Community 8 - "structure.service.ts"
Cohesion: 0.09
Nodes (10): ParseIdPipe, ZodValidationPipe, departmentId, memberId, departmentSelect, MemberLinks, memberRefSelect, teamSelect (+2 more)

### Community 9 - "ai/src/index.ts"
Cohesion: 0.21
Nodes (9): ChatErrorKind, ChatMessage, ChatUsage, assertDimensions(), EMBEDDING_DIMENSIONS, toVectorLiteral(), DEFAULT_EMBEDDING_MODEL, LocalEmbeddingConfig (+1 more)

### Community 10 - "ai.service.ts"
Cohesion: 0.07
Nodes (21): conversationId, NO_ANSWER, ORGANIZATION_RATE_LIMIT, PreparedAnswer, PROVIDER_ERROR_CODES, relevantPassages(), retrievalQuery(), toClientError() (+13 more)

### Community 11 - "getSessionToken"
Cohesion: 0.13
Nodes (35): deleteConversationAction(), error(), POST(), addAclEntryAction(), audienceIds(), currentEntries(), deleteDocumentAction(), documentPath() (+27 more)

### Community 12 - "ApiException"
Cohesion: 0.13
Nodes (12): emailKey(), invalidCredentials(), uniqueViolationOn(), ApiErrorDetail, ApiException, forbidden(), RateLimitedException, unauthenticated() (+4 more)

### Community 13 - "ask/page.tsx"
Cohesion: 0.11
Nodes (22): metadata, loadOrNull(), metadata, DashboardPage(), dynamic, metadata, ROADMAP, StatusRow() (+14 more)

### Community 14 - "packages_types_dist_index"
Cohesion: 0.13
Nodes (16): Detail(), DocumentPage(), loadDocument(), metadata, TEXT_TYPES, textPreview(), AutoRefresh(), dateFormat (+8 more)

### Community 15 - "auth-context.ts"
Cohesion: 0.14
Nodes (12): AuthenticatedRequest, IS_PUBLIC_KEY, REQUIRE_VERIFIED_EMAIL_KEY, AuthModule, SessionAuthGuard, setup(), TOKEN, SessionService (+4 more)

### Community 16 - "CurrentAuth"
Cohesion: 0.14
Nodes (5): CurrentAuth, RequirePermission(), attachment(), DocumentsController, UploadedFileInput

### Community 17 - "session.ts"
Cohesion: 0.13
Nodes (17): logoutAction(), GET(), LoginPage(), metadata, metadata, metadata, sessionCookieName(), sessionCookieOptions() (+9 more)

### Community 18 - "roles.service.ts"
Cohesion: 0.10
Nodes (11): canGrantRoles(), isSubset(), MANAGEMENT_DENIAL_MESSAGES, ManagementVerdict, OWNERSHIP_PERMISSION, Principal, roleId, exceedsYourAccess() (+3 more)

### Community 19 - "api/package.json"
Cohesion: 0.08
Nodes (23): bullmq, dotenv-cli, ioredis, jest, @knowguard/ai, @knowguard/auth, @knowguard/authorization, @knowguard/database (+15 more)

### Community 20 - "documents.service.ts"
Cohesion: 0.07
Nodes (16): documentId, versionId, accessDenied(), AUDIENCE_TYPE, DocumentRow, InspectedUpload, summarySelect, DetectedFileType (+8 more)

### Community 21 - "AuthContext"
Cohesion: 0.11
Nodes (6): AiController, AiService, ConversationsService, toSources(), toView(), AuthContext

### Community 22 - "DocumentsService"
Cohesion: 0.14
Nodes (3): toAuthorizationContext(), IngestionQueue, DocumentsService

### Community 23 - "admin/actions.ts"
Cohesion: 0.23
Nodes (26): addDepartmentMemberAction(), addTeamMemberAction(), call(), createDepartmentAction(), createRoleAction(), createTeamAction(), deleteDepartmentAction(), deleteRoleAction() (+18 more)

### Community 24 - "chunker.ts"
Cohesion: 0.20
Nodes (11): ChunkMetadata, ChunkOptions, DEFAULT_CHUNK_OPTIONS, estimateTokens(), join(), Piece, SectionChunker, sentences() (+3 more)

### Community 25 - "tasks"
Cohesion: 0.09
Nodes (22): dependsOn, outputs, cache, dependsOn, persistent, globalDependencies, globalPassThroughEnv, dependsOn (+14 more)

### Community 26 - "organizations.controller.ts"
Cohesion: 0.15
Nodes (5): OrganizationsController, OrganizationsService, randomSuffix(), slugCandidates(), slugify()

### Community 27 - "logger/package.json"
Cohesion: 0.09
Nodes (19): dependencies, pino, pino-pretty, devDependencies, exports, files, main, name (+11 more)

### Community 28 - "members.service.ts"
Cohesion: 0.13
Nodes (11): permissionsOf(), RoleAssignment, roleIdsOf(), roleKeysOf(), rolesWithPermissionsSelect, memberId, byName(), INVITES_PER_ORG (+3 more)

### Community 29 - "notFound"
Cohesion: 0.20
Nodes (5): notFound(), isUniqueViolation(), nameTaken(), StructureService, toMemberRefs()

### Community 30 - "@nestjs/common"
Cohesion: 0.09
Nodes (14): AiModule, InfrastructureModule, OBJECT_STORAGE, objectStorageProvider, StorageBootstrap, API_ENV, DocumentsModule, MembersModule (+6 more)

### Community 31 - "IngestionError"
Cohesion: 0.19
Nodes (22): assertWithinLimit(), flattenParagraph(), IngestionError, MAX_EXTRACTED_CHARS, normalizeText(), TextBlock, decodeUtf8(), assertSafeZip() (+14 more)

### Community 32 - "documents.ts"
Cohesion: 0.11
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
Nodes (11): API_PREFIX, JobRegistry, logger, main(), chunker, embeddings, GUIDE, logger (+3 more)

### Community 39 - "organization-admin.e2e-spec.ts"
Cohesion: 0.13
Nodes (19): createdOrgIds, createdUserIds, http(), login(), me(), register(), acceptInvitation(), addMember() (+11 more)

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
Cohesion: 0.08
Nodes (23): dependencies, @huggingface/transformers, openai, devDependencies, jest, ts-jest, @types/jest, exports (+15 more)

### Community 48 - "InvitationsService"
Cohesion: 0.14
Nodes (3): InvitationsController, invalidInvitation(), InvitationsService

### Community 49 - "MembersService"
Cohesion: 0.23
Nodes (5): canManageMember(), assertOwnershipRemains(), denied(), effectiveStatus(), MembersService

### Community 51 - "documents.e2e-spec.ts"
Cohesion: 0.15
Nodes (10): createDoc(), upload(), UploadOptions, createIndexer(), embeddings, IndexedPassage, search(), titles() (+2 more)

### Community 52 - "search.service.ts"
Cohesion: 0.10
Nodes (5): SearchModels, Candidate, ChunkRow, SEARCH_RATE_LIMIT, ADR-0008

### Community 53 - "package.json"
Cohesion: 0.18
Nodes (12): description, name, packageManager, private, eslint-config-prettier, @eslint/js, globals, prettier (+4 more)

### Community 54 - "auth/package.json"
Cohesion: 0.06
Nodes (34): ADR 0004 — Credentials, secrets and API errors, API errors, Passwords, Secrets and logging, Sessions, dependencies, @node-rs/argon2, devDependencies (+26 more)

### Community 55 - "web/package.json"
Cohesion: 0.04
Nodes (45): dependencies, class-variance-authority, clsx, @knowguard/types, @knowguard/validation, lucide-react, next, @radix-ui/react-slot (+37 more)

### Community 56 - "env.ts"
Cohesion: 0.12
Nodes (15): ADR-0009, aiEnvShape, ApiEnv, booleanFlag, embeddingEnvShape, logLevel, nodeEnv, postgresUrl (+7 more)

### Community 57 - "auth.service.ts"
Cohesion: 0.11
Nodes (8): AUTH_RATE_LIMITS, Db, IssuedSession, RateLimitRule, requestMeta, INVITATION_RATE_LIMIT, INVITATION_TTL_MS, ADR-0005

### Community 58 - "SearchService"
Cohesion: 0.13
Nodes (5): normalizeRrf(), reciprocalRankFusion(), RRF_K, SearchController, SearchService

### Community 59 - "process-document.ts"
Cohesion: 0.18
Nodes (12): Chunker, DraftChunk, createIngestionHandler(), download(), embeddingInput(), IngestionDeps, IngestionOutcome, markFailed() (+4 more)

### Community 60 - "types/package.json"
Cohesion: 0.14
Nodes (13): dependencies, devDependencies, exports, files, main, name, private, scripts (+5 more)

### Community 61 - "Decisions"
Cohesion: 0.18
Nodes (10): ADR 0006 — Minimal RBAC, invitations and organization structure, Context, Decisions, Directory visibility, Invitations (no email provider yet), Not in Phase 3, Organization structure, Privilege-escalation rules (`management-policy.ts`) (+2 more)

### Community 62 - "auth.ts"
Cohesion: 0.32
Nodes (6): displayName, LoginInput, loginSchema, RegisterInput, registerSchema, validRegistration

### Community 63 - "devDependencies"
Cohesion: 0.17
Nodes (12): devDependencies, dotenv-cli, express, jest, @nestjs/cli, @nestjs/testing, supertest, ts-jest (+4 more)

### Community 64 - "chat.ts"
Cohesion: 0.22
Nodes (8): Provider isolation (spec §34), ChatProvider, ChatProviderError, ChatRequest, ChatStreamEvent, FakeChatProvider, OpenAIChatProvider, toChatError()

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
Nodes (25): devDependencies, dotenv-cli, jest, jszip, pdf-lib, ts-jest, tsx, @types/jest (+17 more)

### Community 70 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, eslint, eslint-config-prettier, @eslint/js, globals, jest-environment-node, prettier, turbo (+3 more)

### Community 72 - "roles.ts"
Cohesion: 0.27
Nodes (6): CreateRoleInput, createRoleSchema, permissionKeys, roleKeyFromName(), UpdateRoleInput, updateRoleSchema

### Community 73 - "s3-object-storage.int-spec.ts"
Cohesion: 0.31
Nodes (4): documentObjectKey(), documentObjectPrefix(), newKey(), storage

### Community 74 - "primitives.ts"
Cohesion: 0.29
Nodes (7): apiEnvSchema, EnvValidationError, parseEnv(), validApiEnv, emailSchema, passwordSchema, slugSchema

### Community 75 - "ADR 0005 — Identity, membership, sessions and the BFF"
Cohesion: 0.20
Nodes (9): ADR 0005 — Identity, membership, sessions and the BFF, Authentication in the API, Browser → Next.js BFF → API, Client IP and deployment requirement, Identity and membership, Not yet implemented (tracked), Rate limiting and brute force, Registration (+1 more)

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

### Community 91 - "health.service.ts"
Cohesion: 0.10
Nodes (6): RedisService, HealthController, HealthModule, HealthService, probe(), makeService()

### Community 92 - "ADR 0009 — Ingestion pipeline and local embeddings"
Cohesion: 0.24
Nodes (6): ADR 0009 — Ingestion pipeline and local embeddings, Extraction (untrusted input), Pipeline (spec §17), Schema, Testing notes, HashEmbeddingProvider

### Community 93 - "ADR 0008 — Documents, storage and query-level access control"
Cohesion: 0.22
Nodes (7): Access rules, ADR 0008 — Documents, storage and query-level access control, Data model, Deferred, Query-level twin of the engine, Storage, Upload flow (spec §16)

### Community 94 - "KnowGuard"
Cohesion: 0.22
Nodes (9): Architecture decisions, Commands, Deploying: required, Environment variables, Getting started, How authentication works, KnowGuard, Layout (+1 more)

### Community 96 - "prompt.ts"
Cohesion: 0.29
Nodes (10): attribute(), buildMessages(), buildSourcesBlock(), MAX_SOURCE_CHARS, neutralizeSourceTags(), parseCitations(), PromptSource, stripCitations() (+2 more)

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

### Community 109 - "types.ts"
Cohesion: 0.18
Nodes (9): ACTION_CAPABILITY, AuthorizationContext, DecisionReason, Effect, RESOURCE_ACTIONS, ResourceAction, SUBJECT_TYPES, SubjectType (+1 more)

### Community 110 - "src/permissions.ts"
Cohesion: 0.30
Nodes (8): isPermissionKey(), PERMISSION_KEYS, PermissionKey, PERMISSIONS, SYSTEM_ROLE_KEYS, SYSTEM_ROLES, SystemRoleDefinition, SystemRoleKey

### Community 111 - "ADR 0010 — Permission-aware hybrid search"
Cohesion: 0.25
Nodes (7): ADR 0010 — Permission-aware hybrid search, Authorization first (spec §2, §20), Indexes and schema drift, Operational notes, Retrieval and ranking, Web, Why this reranker, and a known weakness

### Community 112 - "KnowGuard — guide for AI assistants"
Cohesion: 0.15
Nodes (11): auth(), Commands, Gotchas, KnowGuard — guide for AI assistants, Layout, Orientation: use the knowledge graph first, Security rules that must hold, ADR 0001 — Modular monolith, separate worker, internal packages (+3 more)

### Community 113 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, lint, test, test:e2e, typecheck

### Community 114 - "devDependencies"
Cohesion: 0.40
Nodes (5): devDependencies, dotenv-cli, jest, ts-jest, @types/jest

### Community 116 - ".prettierrc.json"
Cohesion: 0.40
Nodes (4): printWidth, semi, singleQuote, trailingComma

### Community 117 - "engine.property.spec.ts"
Cohesion: 0.17
Nodes (9): action, context, entry, id, ids, org, resource, RUNS (+1 more)

### Community 120 - "ADR 0003 — Tenant isolation enforced in the schema"
Cohesion: 0.40
Nodes (4): ADR 0003 — Tenant isolation enforced in the schema, Consequences, Context, Decision

### Community 121 - "ADR 0007 — Authorization engine and custom roles"
Cohesion: 0.40
Nodes (4): ADR 0007 — Authorization engine and custom roles, Context, Decision: custom roles, Deferred

### Community 123 - "LocalReranker"
Cohesion: 0.21
Nodes (6): DEFAULT_RERANKER_MODEL, LocalReranker, LocalRerankerConfig, Reranker, ADR-0010, @huggingface/transformers

### Community 126 - "PinoNestLogger"
Cohesion: 0.18
Nodes (3): AppModule, PinoNestLogger, main()

### Community 127 - "dependencies"
Cohesion: 0.18
Nodes (11): dependencies, bullmq, ioredis, @knowguard/ai, @knowguard/database, @knowguard/logger, @knowguard/storage, @knowguard/types (+3 more)

### Community 128 - "ADR 0011 — Ask AI: grounded answers from authorized passages"
Cohesion: 0.20
Nodes (10): ADR 0011 — Ask AI: grounded answers from authorized passages, Citations, Consequences, Conversations, Cost controls, Model choice, Prompt (spec §24–25), Relevance: when not to call the model (+2 more)

### Community 129 - "api-exception.filter.ts"
Cohesion: 0.28
Nodes (4): ApiExceptionFilter, clientErrorStatus(), DEFAULT_CODES, INTERNAL

### Community 130 - "zod"
Cohesion: 0.28
Nodes (6): AiQueryInput, aiQuerySchema, uuidSchema, SearchRequest, searchRequestSchema, zod

### Community 131 - "scripts"
Cohesion: 0.25
Nodes (8): scripts, build, dev, lint, start, test, test:e2e, typecheck

### Community 132 - "engine.spec.ts"
Cohesion: 0.25
Nodes (3): ALL_PERMISSIONS, EMPLOYEE_PERMISSIONS, AclEntry

## Knowledge Gaps
- **878 isolated node(s):** `TrustFn`, `MessageRow`, `Events`, `DecisionReason`, `Effect` (+873 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1119 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AuthContext` connect `AuthContext` to `auth.service.spec.ts`, `structure.service.ts`, `ai.service.ts`, `auth-context.ts`, `CurrentAuth`, `roles.service.ts`, `documents.service.ts`, `DocumentsService`, `organizations.controller.ts`, `members.service.ts`, `MembersService`, `DepartmentsController`, `search.service.ts`, `auth.service.ts`, `SearchService`, `TeamsController`, `MembersController`, `RolesController`, `KnowGuard — guide for AI assistants`?**
  _High betweenness centrality (0.090) - this node is a cross-community bridge._
- **Why does `@nestjs/common` connect `@nestjs/common` to `bootstrap.ts`, `api-exception.filter.ts`, `ingestion.int-spec.ts`, `organization-admin.e2e-spec.ts`, `structure.service.ts`, `ai.service.ts`, `ApiException`, `PrismaService`, `auth-context.ts`, `roles.service.ts`, `api/package.json`, `documents.service.ts`, `search.service.ts`, `documents.e2e-spec.ts`, `auth.service.ts`, `organizations.controller.ts`, `health.service.ts`, `members.service.ts`?**
  _High betweenness centrality (0.074) - this node is a cross-community bridge._
- **What connects `TrustFn`, `MessageRow`, `Events` to the rest of the system?**
  _878 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `20260929114255_init/migration.sql` be split into smaller, more focused modules?**
  _Cohesion score 0.05594679186228482 - nodes in this community are weakly interconnected._
- **Should `auth.service.spec.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.10317460317460317 - nodes in this community are weakly interconnected._
- **Should `document-access.int-spec.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05928614640048397 - nodes in this community are weakly interconnected._
- **Should `types/src/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0425531914893617 - nodes in this community are weakly interconnected._
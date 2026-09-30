# Graph Report - knowguard  (2026-10-01)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 2240 nodes · 4943 edges · 126 communities (112 shown, 14 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 114 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `5c5335e4`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- test-app.ts
- 20260929114255_init/migration.sql
- engine.property.spec.ts
- next
- packages_types_dist_index
- .login
- document-access.int-spec.ts
- types/src/index.ts
- structure.service.ts
- ai/src/index.ts
- ingestion.int-spec.ts
- getSessionToken
- members.service.ts
- dashboard/page.tsx
- [id]/page.tsx
- auth-context.ts
- CurrentAuth
- auth.service.spec.ts
- RolesService
- api/package.json
- documents.service.ts
- @nestjs/common
- ApiException
- admin/actions.ts
- chunker.ts
- tasks
- organizations.controller.ts
- logger/package.json
- SessionService
- StructureService
- documents.e2e-spec.ts
- IngestionError
- documents.ts
- organization.ts
- storage/package.json
- helpers.ts
- compilerOptions
- compilerOptions
- registry.ts
- organization-admin.e2e-spec.ts
- api/tsconfig.build.json
- scripts
- dependencies
- validation/package.json
- (auth)/actions.ts
- components.json
- database/package.json
- ai/package.json
- .accept
- AuthContext
- DepartmentsController
- TeamsController
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
- dependencies
- authorization/package.json
- LocalEmbeddingProvider
- database/tsconfig.json
- compilerOptions
- worker/package.json
- devDependencies
- session.service.ts
- roles.ts
- s3-object-storage.int-spec.ts
- primitives.ts
- ADR 0005 — Identity, membership, sessions and the BFF
- search-view.tsx
- devDependencies
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
- PrismaService
- ADR 0009 — Ingestion pipeline and local embeddings
- ADR 0008 — Documents, storage and query-level access control
- KnowGuard
- scripts
- extract.spec.ts
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
- management-policy.spec.ts
- scripts
- ADR 0010 — Permission-aware hybrid search
- ADR 0001 — Modular monolith, separate worker, internal packages
- scripts
- devDependencies
- README.md
- .prettierrc.json
- web/eslint.config.mjs
- postcss.config.mjs
- ADR 0003 — Tenant isolation enforced in the schema
- ADR 0007 — Authorization engine and custom roles
- LocalReranker
- next.config.ts
- AGENTS.md

## God Nodes (most connected - your core abstractions)
1. `AuthContext` - 86 edges
2. `@nestjs/common` - 57 edges
3. `CurrentAuth` - 49 edges
4. `RequirePermission()` - 46 edges
5. `ApiException` - 45 edges
6. `getSessionToken()` - 40 edges
7. `PrismaService` - 38 edges
8. `Card()` - 36 edges
9. `apiRequest()` - 34 edges
10. `CardContent()` - 34 edges

## Surprising Connections (you probably didn't know these)
- `Authentication in the API` --references--> `SessionAuthGuard`  [INFERRED]
  docs/adr/0005-identity-membership-and-sessions.md → apps/api/src/auth/session-auth.guard.ts
- `API errors` --references--> `ApiException`  [INFERRED]
  docs/adr/0004-credentials-and-errors.md → apps/api/src/common/api-exception.ts
- `Pipeline (spec §17)` --references--> `IngestionError`  [INFERRED]
  docs/adr/0009-ingestion-and-embeddings.md → apps/worker/src/ingestion/blocks.ts
- `Tenant scoping` --references--> `ParseIdPipe`  [INFERRED]
  docs/adr/0006-rbac-invitations-and-organization-structure.md → apps/api/src/common/parse-id.pipe.ts
- `Browser → Next.js BFF → API` --references--> `requireUser()`  [INFERRED]
  docs/adr/0005-identity-membership-and-sessions.md → apps/web/lib/session.ts

## Import Cycles
- None detected.

## Communities (126 total, 14 thin omitted)

### Community 0 - "test-app.ts"
Cohesion: 0.11
Nodes (16): AppModule, API_PREFIX, configureApp(), parseTrustProxy(), ApiExceptionFilter, clientErrorStatus(), DEFAULT_CODES, INTERNAL (+8 more)

### Community 1 - "20260929114255_init/migration.sql"
Cohesion: 0.06
Nodes (60): "department_memberships", department_memberships_organization_id_idx, department_memberships_user_id_idx, "departments", departments_id_organization_id_key, departments_organization_id_name_key, "organizations", organizations_slug_key (+52 more)

### Community 2 - "engine.property.spec.ts"
Cohesion: 0.06
Nodes (41): Decision: one pure engine, Evaluation order (first match wins), Phase 5 obligation: query-level equivalence, Semantics we chose (the spec leaves these open), Verification, authorize(), deny(), inheritsRead() (+33 more)

### Community 3 - "next"
Cohesion: 0.14
Nodes (19): AuthFormState, LoginPage(), metadata, metadata, Action, ActionFormProps, CopyField(), AcceptInvitationForm() (+11 more)

### Community 4 - "packages_types_dist_index"
Cohesion: 0.16
Nodes (42): DepartmentsPage(), metadata, metadata, PermissionsPage(), metadata, RoleCard(), RoleFields(), RolesPage() (+34 more)

### Community 6 - "document-access.int-spec.ts"
Cohesion: 0.06
Nodes (31): PinoNestLogger, Authorization first (spec §2, §20), main(), ORGANIZATION, USERS, createPrismaClient(), CreatePrismaClientOptions, aclSubjectMatches() (+23 more)

### Community 7 - "types/src/index.ts"
Cohesion: 0.05
Nodes (42): AclEntryView, AclSubjectTypeValue, ApiErrorBody, DepartmentDetails, DepartmentListResponse, DependencyStatus, DocumentActionValue, DocumentCapabilities (+34 more)

### Community 8 - "structure.service.ts"
Cohesion: 0.07
Nodes (11): ParseIdPipe, ZodValidationPipe, memberId, departmentId, memberId, departmentSelect, MemberLinks, memberRefSelect (+3 more)

### Community 9 - "ai/src/index.ts"
Cohesion: 0.22
Nodes (10): assertDimensions(), EMBEDDING_DIMENSIONS, toVectorLiteral(), DEFAULT_EMBEDDING_MODEL, LocalEmbeddingConfig, DEFAULT_RERANKER_MODEL, LocalRerankerConfig, Reranker (+2 more)

### Community 10 - "ingestion.int-spec.ts"
Cohesion: 0.12
Nodes (6): chunker, embeddings, GUIDE, logger, orgs, storage

### Community 11 - "getSessionToken"
Cohesion: 0.14
Nodes (34): addAclEntryAction(), audienceIds(), currentEntries(), deleteDocumentAction(), documentPath(), Entry, field(), reindexDocumentAction() (+26 more)

### Community 12 - "members.service.ts"
Cohesion: 0.09
Nodes (14): canManageMember(), MANAGEMENT_DENIAL_MESSAGES, ManagementVerdict, OWNERSHIP_PERMISSION, Principal, byName(), INVITES_PER_ORG, MemberRow (+6 more)

### Community 13 - "dashboard/page.tsx"
Cohesion: 0.33
Nodes (8): DashboardPage(), dynamic, metadata, ROADMAP, StatusRow(), Badge(), badgeVariants, getApiHealth()

### Community 14 - "[id]/page.tsx"
Cohesion: 0.13
Nodes (21): Detail(), DocumentPage(), loadDocument(), metadata, SharingCard(), TEXT_TYPES, textPreview(), DocumentsPage() (+13 more)

### Community 15 - "auth-context.ts"
Cohesion: 0.14
Nodes (12): AuthenticatedRequest, IS_PUBLIC_KEY, REQUIRE_VERIFIED_EMAIL_KEY, SessionAuthGuard, setup(), TOKEN, REQUIRED_PERMISSIONS_KEY, ApiErrorDetail (+4 more)

### Community 16 - "CurrentAuth"
Cohesion: 0.14
Nodes (5): CurrentAuth, RequirePermission(), attachment(), DocumentsController, UploadedFileInput

### Community 17 - "auth.service.spec.ts"
Cohesion: 0.11
Nodes (9): AuthService, meta, setup(), StoredUser, { verifyPassword }, RoleAssignment, roleIdsOf(), roleKeysOf() (+1 more)

### Community 18 - "RolesService"
Cohesion: 0.11
Nodes (5): canGrantRoles(), isSubset(), RolesController, exceedsYourAccess(), RolesService

### Community 19 - "api/package.json"
Cohesion: 0.08
Nodes (25): bullmq, dotenv-cli, ioredis, jest, @knowguard/ai, @knowguard/auth, @knowguard/authorization, @knowguard/database (+17 more)

### Community 20 - "documents.service.ts"
Cohesion: 0.07
Nodes (15): documentId, versionId, accessDenied(), AUDIENCE_TYPE, DocumentRow, InspectedUpload, summarySelect, DetectedFileType (+7 more)

### Community 21 - "@nestjs/common"
Cohesion: 0.14
Nodes (9): AuthModule, HealthController, HealthModule, InvitationsModule, MembersModule, OrganizationsModule, SearchModule, StructureModule (+1 more)

### Community 22 - "ApiException"
Cohesion: 0.20
Nodes (4): toAuthorizationContext(), ApiException, notFound(), DocumentsService

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

### Community 28 - "SessionService"
Cohesion: 0.13
Nodes (6): emailKey(), invalidCredentials(), uniqueViolationOn(), SessionService, invalidInvitation(), InvitationsService

### Community 29 - "StructureService"
Cohesion: 0.20
Nodes (4): isUniqueViolation(), nameTaken(), StructureService, toMemberRefs()

### Community 30 - "documents.e2e-spec.ts"
Cohesion: 0.09
Nodes (10): InfrastructureModule, OBJECT_STORAGE, objectStorageProvider, StorageBootstrap, HealthService, probe(), makeService(), createDoc() (+2 more)

### Community 31 - "IngestionError"
Cohesion: 0.27
Nodes (16): assertWithinLimit(), flattenParagraph(), IngestionError, MAX_EXTRACTED_CHARS, normalizeText(), TextBlock, decodeUtf8(), assertSafeZip() (+8 more)

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
Cohesion: 0.26
Nodes (11): inviteEmployee(), isolateClientIp(), loginViaUi(), PASSWORD, registerViaUi(), SESSION_COOKIE, signOut(), uniqueEmail() (+3 more)

### Community 36 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 37 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, declaration, declarationMap, esModuleInterop, exactOptionalPropertyTypes, forceConsistentCasingInFileNames, isolatedModules, lib (+11 more)

### Community 38 - "registry.ts"
Cohesion: 0.24
Nodes (4): JobHandler, JobRegistry, logger, main()

### Community 39 - "organization-admin.e2e-spec.ts"
Cohesion: 0.10
Nodes (22): createdOrgIds, createdUserIds, http(), login(), me(), register(), acceptInvitation(), addMember() (+14 more)

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

### Community 44 - "(auth)/actions.ts"
Cohesion: 0.10
Nodes (29): AppLayout(), acceptInvitationAction(), capitalize(), field(), fieldErrorsFrom(), loginAction(), logoutAction(), messageFor() (+21 more)

### Community 45 - "components.json"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 46 - "database/package.json"
Cohesion: 0.05
Nodes (40): dependencies, @knowguard/authorization, @prisma/client, devDependencies, dotenv-cli, fast-check, jest, @knowguard/auth (+32 more)

### Community 47 - "ai/package.json"
Cohesion: 0.12
Nodes (16): dependencies, @huggingface/transformers, devDependencies, jest, ts-jest, @types/jest, exports, files (+8 more)

### Community 49 - "AuthContext"
Cohesion: 0.15
Nodes (7): AuthContext, assertOwnershipRemains(), permissionsOf(), MembersController, denied(), effectiveStatus(), MembersService

### Community 52 - "search.service.ts"
Cohesion: 0.08
Nodes (11): RateLimitedException, RateLimiterService, ExecResult, limiterWith(), rule, RedisService, SearchModels, Candidate (+3 more)

### Community 53 - "package.json"
Cohesion: 0.15
Nodes (14): description, engines, node, name, packageManager, private, eslint-config-prettier, @eslint/js (+6 more)

### Community 54 - "auth/package.json"
Cohesion: 0.06
Nodes (34): ADR 0004 — Credentials, secrets and API errors, API errors, Passwords, Secrets and logging, Sessions, dependencies, @node-rs/argon2, devDependencies (+26 more)

### Community 55 - "web/package.json"
Cohesion: 0.12
Nodes (16): dotenv-cli, @knowguard/types, @knowguard/validation, name, private, version, class-variance-authority, clsx (+8 more)

### Community 56 - "env.ts"
Cohesion: 0.13
Nodes (14): ADR-0009, ApiEnv, apiEnvSchema, booleanFlag, embeddingEnvShape, logLevel, nodeEnv, postgresUrl (+6 more)

### Community 57 - "auth.service.ts"
Cohesion: 0.14
Nodes (7): AUTH_RATE_LIMITS, RateLimitRule, requestMeta, INVITATION_RATE_LIMIT, INVITATION_TTL_MS, ADR-0005, express

### Community 58 - "SearchService"
Cohesion: 0.14
Nodes (5): normalizeRrf(), reciprocalRankFusion(), RRF_K, SearchController, SearchService

### Community 59 - "process-document.ts"
Cohesion: 0.26
Nodes (7): createIngestionHandler(), download(), embeddingInput(), IngestionOutcome, markFailed(), processDocument(), setStatus()

### Community 60 - "types/package.json"
Cohesion: 0.14
Nodes (13): dependencies, devDependencies, exports, files, main, name, private, scripts (+5 more)

### Community 61 - "Decisions"
Cohesion: 0.18
Nodes (10): ADR 0006 — Minimal RBAC, invitations and organization structure, Context, Decisions, Directory visibility, Invitations (no email provider yet), Not in Phase 3, Organization structure, Privilege-escalation rules (`management-policy.ts`) (+2 more)

### Community 62 - "auth.ts"
Cohesion: 0.21
Nodes (9): displayName, LoginInput, loginSchema, RegisterInput, registerSchema, validRegistration, SearchRequest, searchRequestSchema (+1 more)

### Community 63 - "devDependencies"
Cohesion: 0.17
Nodes (12): devDependencies, dotenv-cli, express, jest, @nestjs/cli, @nestjs/testing, supertest, ts-jest (+4 more)

### Community 64 - "dependencies"
Cohesion: 0.17
Nodes (12): dependencies, class-variance-authority, clsx, @knowguard/types, @knowguard/validation, lucide-react, next, @radix-ui/react-slot (+4 more)

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
Cohesion: 0.04
Nodes (44): dependencies, bullmq, ioredis, @knowguard/ai, @knowguard/database, @knowguard/logger, @knowguard/storage, @knowguard/types (+36 more)

### Community 70 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, eslint, eslint-config-prettier, @eslint/js, globals, jest-environment-node, prettier, turbo (+3 more)

### Community 71 - "session.service.ts"
Cohesion: 0.21
Nodes (4): Db, IssuedSession, API_ENV, DocumentsModule

### Community 72 - "roles.ts"
Cohesion: 0.27
Nodes (6): CreateRoleInput, createRoleSchema, permissionKeys, roleKeyFromName(), UpdateRoleInput, updateRoleSchema

### Community 73 - "s3-object-storage.int-spec.ts"
Cohesion: 0.31
Nodes (4): documentObjectKey(), documentObjectPrefix(), newKey(), storage

### Community 74 - "primitives.ts"
Cohesion: 0.29
Nodes (7): EnvValidationError, parseEnv(), validApiEnv, emailSchema, passwordSchema, slugSchema, uuidSchema

### Community 75 - "ADR 0005 — Identity, membership, sessions and the BFF"
Cohesion: 0.20
Nodes (9): ADR 0005 — Identity, membership, sessions and the BFF, Authentication in the API, Browser → Next.js BFF → API, Client IP and deployment requirement, Identity and membership, Not yet implemented (tracked), Rate limiting and brute force, Registration (+1 more)

### Community 76 - "search-view.tsx"
Cohesion: 0.38
Nodes (7): searchAction(), SearchState, escapeRegExp(), Highlight(), highlightTerms(), SearchView(), lucide-react

### Community 77 - "devDependencies"
Cohesion: 0.22
Nodes (9): devDependencies, dotenv-cli, eslint-config-next, @playwright/test, postcss, tailwindcss, @tailwindcss/postcss, @types/react (+1 more)

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

### Community 91 - "PrismaService"
Cohesion: 0.09
Nodes (3): IngestionQueue, PermissionCatalogSync, PrismaService

### Community 92 - "ADR 0009 — Ingestion pipeline and local embeddings"
Cohesion: 0.24
Nodes (6): ADR 0009 — Ingestion pipeline and local embeddings, Extraction (untrusted input), Pipeline (spec §17), Schema, Testing notes, HashEmbeddingProvider

### Community 93 - "ADR 0008 — Documents, storage and query-level access control"
Cohesion: 0.22
Nodes (7): Access rules, ADR 0008 — Documents, storage and query-level access control, Data model, Deferred, Query-level twin of the engine, Storage, Upload flow (spec §16)

### Community 94 - "KnowGuard"
Cohesion: 0.22
Nodes (9): Architecture decisions, Commands, Deploying: required, Environment variables, Getting started, How authentication works, KnowGuard, Layout (+1 more)

### Community 95 - "scripts"
Cohesion: 0.29
Nodes (7): scripts, build, dev, lint, start, test:browser, typecheck

### Community 96 - "extract.spec.ts"
Cohesion: 0.36
Nodes (6): DocxPart, makeDocx(), makePdf(), makeZipBomb(), jszip, pdf-lib

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

### Community 109 - "management-policy.spec.ts"
Cohesion: 0.29
Nodes (4): ADMIN, EMPLOYEE, MANAGER, OWNER

### Community 110 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, lint, test, typecheck

### Community 111 - "ADR 0010 — Permission-aware hybrid search"
Cohesion: 0.29
Nodes (6): ADR 0010 — Permission-aware hybrid search, Indexes and schema drift, Operational notes, Retrieval and ranking, Web, Why this reranker, and a known weakness

### Community 112 - "ADR 0001 — Modular monolith, separate worker, internal packages"
Cohesion: 0.33
Nodes (5): auth(), ADR 0001 — Modular monolith, separate worker, internal packages, Consequences, Context, Decision

### Community 113 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, lint, test, test:e2e, typecheck

### Community 114 - "devDependencies"
Cohesion: 0.40
Nodes (5): devDependencies, dotenv-cli, jest, ts-jest, @types/jest

### Community 116 - ".prettierrc.json"
Cohesion: 0.40
Nodes (4): printWidth, semi, singleQuote, trailingComma

### Community 120 - "ADR 0003 — Tenant isolation enforced in the schema"
Cohesion: 0.40
Nodes (4): ADR 0003 — Tenant isolation enforced in the schema, Consequences, Context, Decision

### Community 121 - "ADR 0007 — Authorization engine and custom roles"
Cohesion: 0.40
Nodes (4): ADR 0007 — Authorization engine and custom roles, Context, Decision: custom roles, Deferred

## Knowledge Gaps
- **841 isolated node(s):** `TrustFn`, `Entry`, `HealthResult`, `RequestOptions`, `Principal` (+836 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1055 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AuthContext` connect `AuthContext` to `SearchService`, `.login`, `session.service.ts`, `structure.service.ts`, `members.service.ts`, `auth-context.ts`, `CurrentAuth`, `auth.service.spec.ts`, `RolesService`, `DepartmentsController`, `documents.service.ts`, `search.service.ts`, `ApiException`, `TeamsController`, `auth.service.ts`, `organizations.controller.ts`?**
  _High betweenness centrality (0.073) - this node is a cross-community bridge._
- **Why does `@nestjs/common` connect `@nestjs/common` to `test-app.ts`, `registry.ts`, `session.service.ts`, `structure.service.ts`, `organization-admin.e2e-spec.ts`, `members.service.ts`, `auth-context.ts`, `api/package.json`, `search.service.ts`, `documents.service.ts`, `auth.service.ts`, `organizations.controller.ts`, `PrismaService`, `documents.e2e-spec.ts`?**
  _High betweenness centrality (0.073) - this node is a cross-community bridge._
- **Why does `next` connect `next` to `packages_types_dist_index`, `getSessionToken`, `(auth)/actions.ts`, `dashboard/page.tsx`, `[id]/page.tsx`, `search-view.tsx`, `web/package.json`, `admin/actions.ts`, `next.config.ts`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **What connects `TrustFn`, `Entry`, `HealthResult` to the rest of the system?**
  _841 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `test-app.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.10606060606060606 - nodes in this community are weakly interconnected._
- **Should `20260929114255_init/migration.sql` be split into smaller, more focused modules?**
  _Cohesion score 0.06153846153846154 - nodes in this community are weakly interconnected._
- **Should `engine.property.spec.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0647307924984876 - nodes in this community are weakly interconnected._
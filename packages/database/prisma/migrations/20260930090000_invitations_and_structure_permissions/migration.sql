-- CreateTable
CREATE TABLE "invitations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "invited_by_id" UUID,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "accepted_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invitations_token_hash_key" ON "invitations"("token_hash");

-- CreateIndex
CREATE INDEX "invitations_user_id_organization_id_idx" ON "invitations"("user_id", "organization_id");

-- CreateIndex
CREATE INDEX "invitations_organization_id_idx" ON "invitations"("organization_id");

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_user_id_organization_id_fkey" FOREIGN KEY ("user_id", "organization_id") REFERENCES "user_organizations"("user_id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Data: new catalog permissions (Phase 3) and their grants for EXISTING organizations.
-- New organizations get them via provisionSystemRoles; the API also syncs the catalog on boot
-- (descriptions), so ON CONFLICT keeps this idempotent with that sync.
INSERT INTO "permissions" ("id", "key", "description", "created_at") VALUES
    (gen_random_uuid(), 'department.manage', 'Create, rename and delete departments and manage their members', CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'team.manage', 'Create, rename and delete teams and manage their members', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
SELECT r."id", p."id", CURRENT_TIMESTAMP
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."is_system" = true
  AND r."key" IN ('OWNER', 'ADMIN')
  AND p."key" IN ('department.manage', 'team.manage')
ON CONFLICT DO NOTHING;

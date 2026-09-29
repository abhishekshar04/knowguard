-- Phase 2: global user identities + organization memberships + server-side sessions.
--
-- Hand-ordered so existing data survives: memberships are backfilled from
-- users.organization_id BEFORE foreign keys are re-pointed and the column is dropped.

-- 1. New types and tables --------------------------------------------------------------

CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'INVITED', 'SUSPENDED');

CREATE TABLE "user_organizations" (
    "user_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_organizations_pkey" PRIMARY KEY ("user_id","organization_id")
);

CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "user_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "revoked_reason" VARCHAR(64),
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(512),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "users"
ADD COLUMN "email_verified_at" TIMESTAMPTZ(3),
ADD COLUMN "last_login_at" TIMESTAMPTZ(3);

-- 2. Backfill memberships from the old single-organization column ---------------------

INSERT INTO "user_organizations" ("user_id", "organization_id", "status", "created_at", "updated_at")
SELECT
    "id",
    "organization_id",
    CASE WHEN "status" = 'INVITED' THEN 'INVITED'::"MembershipStatus" ELSE 'ACTIVE'::"MembershipStatus" END,
    "created_at",
    CURRENT_TIMESTAMP
FROM "users";

-- 3. Indexes ------------------------------------------------------------------------------

CREATE INDEX "user_organizations_organization_id_status_idx" ON "user_organizations"("organization_id", "status");
-- MVP: one organization per user. Drop this index to allow multi-organization users.
CREATE UNIQUE INDEX "user_organizations_single_org_per_user_key" ON "user_organizations"("user_id");
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");
CREATE INDEX "sessions_user_id_revoked_at_idx" ON "sessions"("user_id", "revoked_at");
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- 4. Re-point tenant-scoped user relations from users(id, organization_id) to memberships -

ALTER TABLE "department_memberships" DROP CONSTRAINT "department_memberships_user_id_organization_id_fkey";
ALTER TABLE "team_memberships" DROP CONSTRAINT "team_memberships_user_id_organization_id_fkey";
ALTER TABLE "user_roles" DROP CONSTRAINT "user_roles_user_id_organization_id_fkey";

ALTER TABLE "user_organizations" ADD CONSTRAINT "user_organizations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_organizations" ADD CONSTRAINT "user_organizations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_organization_id_fkey" FOREIGN KEY ("user_id", "organization_id") REFERENCES "user_organizations"("user_id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "department_memberships" ADD CONSTRAINT "department_memberships_user_id_organization_id_fkey" FOREIGN KEY ("user_id", "organization_id") REFERENCES "user_organizations"("user_id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "team_memberships" ADD CONSTRAINT "team_memberships_user_id_organization_id_fkey" FOREIGN KEY ("user_id", "organization_id") REFERENCES "user_organizations"("user_id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_organization_id_fkey" FOREIGN KEY ("user_id", "organization_id") REFERENCES "user_organizations"("user_id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. Drop the single-organization coupling on users ---------------------------------------

ALTER TABLE "users" DROP CONSTRAINT "users_organization_id_fkey";
DROP INDEX "users_id_organization_id_key";
DROP INDEX "users_organization_id_status_idx";
ALTER TABLE "users" DROP COLUMN "organization_id";

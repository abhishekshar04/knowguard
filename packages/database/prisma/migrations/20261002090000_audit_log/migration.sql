-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('DOCUMENT_VIEW', 'DOCUMENT_DOWNLOAD', 'DOCUMENT_CREATE', 'DOCUMENT_UPDATE', 'DOCUMENT_DELETE', 'DOCUMENT_SHARE', 'PERMISSION_CHANGE', 'USER_CREATED', 'USER_INVITED', 'USER_SUSPENDED', 'USER_REACTIVATED', 'ROLE_CHANGED', 'GROUP_CHANGED', 'LOGIN', 'LOGIN_FAILED', 'ACCESS_DENIED', 'SEARCH', 'AI_QUERY');

-- CreateEnum
CREATE TYPE "AuditResult" AS ENUM ('SUCCESS', 'DENIED', 'FAILURE');

-- CreateEnum
CREATE TYPE "AuditResourceType" AS ENUM ('DOCUMENT', 'USER', 'ROLE', 'TEAM', 'DEPARTMENT', 'CONVERSATION', 'SESSION', 'ENDPOINT');

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID,
    "action" "AuditAction" NOT NULL,
    "resource_type" "AuditResourceType" NOT NULL,
    "resource_id" UUID,
    "result" "AuditResult" NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ip" VARCHAR(64),
    "user_agent" VARCHAR(512),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_created_at_idx" ON "audit_logs"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_action_created_at_idx" ON "audit_logs"("organization_id", "action", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_user_id_created_at_idx" ON "audit_logs"("organization_id", "user_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_resource_type_resource_id_idx" ON "audit_logs"("organization_id", "resource_type", "resource_id");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Append-only audit log (ADR 0012). Updates are always rejected. Deletes and truncation are
-- rejected unless the transaction opts in with SET LOCAL knowguard.audit_purge = 'on'
-- (retention jobs, test cleanup, organization deletion).
CREATE FUNCTION audit_logs_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'audit_logs is append-only: UPDATE is not allowed' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF coalesce(current_setting('knowguard.audit_purge', true), '') <> 'on' THEN
    RAISE EXCEPTION 'audit_logs is append-only: % requires knowguard.audit_purge', TG_OP USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NULL END;
END;
$$;

CREATE TRIGGER audit_logs_no_update_or_delete
  BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION audit_logs_append_only();

CREATE TRIGGER audit_logs_no_truncate
  BEFORE TRUNCATE ON "audit_logs"
  FOR EACH STATEMENT EXECUTE FUNCTION audit_logs_append_only();

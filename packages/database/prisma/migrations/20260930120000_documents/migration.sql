-- CreateEnum
CREATE TYPE "DocumentVisibility" AS ENUM ('PRIVATE', 'CUSTOM', 'ROLE', 'TEAM', 'DEPARTMENT', 'ORGANIZATION');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('UPLOADING', 'PROCESSING', 'INDEXING', 'READY', 'FAILED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AclSubjectType" AS ENUM ('USER', 'ROLE', 'TEAM', 'DEPARTMENT');

-- CreateEnum
CREATE TYPE "DocumentAction" AS ENUM ('READ', 'WRITE', 'DELETE', 'SHARE');

-- CreateEnum
CREATE TYPE "AclEffect" AS ENUM ('ALLOW', 'DENY');

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "description" TEXT,
    "owner_id" UUID NOT NULL,
    "visibility" "DocumentVisibility" NOT NULL DEFAULT 'PRIVATE',
    "status" "DocumentStatus" NOT NULL DEFAULT 'UPLOADING',
    "current_version_id" UUID,
    "current_version" INTEGER NOT NULL DEFAULT 0,
    "mime_type" VARCHAR(127) NOT NULL,
    "size" INTEGER NOT NULL,
    "storage_key" VARCHAR(512) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_versions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "storage_key" VARCHAR(512) NOT NULL,
    "content_hash" CHAR(64) NOT NULL,
    "mime_type" VARCHAR(127) NOT NULL,
    "size" INTEGER NOT NULL,
    "original_filename" VARCHAR(255) NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_audiences" (
    "document_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "target_id" UUID NOT NULL,

    CONSTRAINT "document_audiences_pkey" PRIMARY KEY ("document_id","target_id")
);

-- CreateTable
CREATE TABLE "document_permissions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "subject_type" "AclSubjectType" NOT NULL,
    "subject_id" UUID NOT NULL,
    "permission" "DocumentAction" NOT NULL,
    "effect" "AclEffect" NOT NULL DEFAULT 'ALLOW',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "documents_organization_id_visibility_idx" ON "documents"("organization_id", "visibility");

-- CreateIndex
CREATE INDEX "documents_organization_id_owner_id_idx" ON "documents"("organization_id", "owner_id");

-- CreateIndex
CREATE INDEX "documents_organization_id_updated_at_idx" ON "documents"("organization_id", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "documents_id_organization_id_key" ON "documents"("id", "organization_id");

-- CreateIndex
CREATE INDEX "document_versions_organization_id_idx" ON "document_versions"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_versions_document_id_version_key" ON "document_versions"("document_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "document_versions_id_organization_id_key" ON "document_versions"("id", "organization_id");

-- CreateIndex
CREATE INDEX "document_audiences_organization_id_target_id_idx" ON "document_audiences"("organization_id", "target_id");

-- CreateIndex
CREATE INDEX "document_permissions_organization_id_subject_type_subject_i_idx" ON "document_permissions"("organization_id", "subject_type", "subject_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_permissions_document_id_subject_type_subject_id_pe_key" ON "document_permissions"("document_id", "subject_type", "subject_id", "permission");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_owner_id_organization_id_fkey" FOREIGN KEY ("owner_id", "organization_id") REFERENCES "user_organizations"("user_id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_document_id_organization_id_fkey" FOREIGN KEY ("document_id", "organization_id") REFERENCES "documents"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_created_by_id_organization_id_fkey" FOREIGN KEY ("created_by_id", "organization_id") REFERENCES "user_organizations"("user_id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_audiences" ADD CONSTRAINT "document_audiences_document_id_organization_id_fkey" FOREIGN KEY ("document_id", "organization_id") REFERENCES "documents"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_permissions" ADD CONSTRAINT "document_permissions_document_id_organization_id_fkey" FOREIGN KEY ("document_id", "organization_id") REFERENCES "documents"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;


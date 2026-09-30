-- pgvector ships with the postgres image; enabling it here makes the schema self-describing.
CREATE EXTENSION IF NOT EXISTS vector;

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "indexed_at" TIMESTAMPTZ(3),
ADD COLUMN     "processing_error" VARCHAR(500);

-- CreateTable
CREATE TABLE "document_chunks" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "token_count" INTEGER NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "embedding" vector(384),
    "embedding_model" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_chunks_organization_id_document_id_idx" ON "document_chunks"("organization_id", "document_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_chunks_version_id_chunk_index_key" ON "document_chunks"("version_id", "chunk_index");

-- AddForeignKey
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_document_id_organization_id_fkey" FOREIGN KEY ("document_id", "organization_id") REFERENCES "documents"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_version_id_organization_id_fkey" FOREIGN KEY ("version_id", "organization_id") REFERENCES "document_versions"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;


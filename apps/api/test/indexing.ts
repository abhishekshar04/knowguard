import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { LocalEmbeddingProvider, toVectorLiteral } from '@knowguard/ai';
import type { DocumentDetails } from '@knowguard/types';

import type { PrismaService } from '../src/common/prisma.service';
import type { TestClient } from './test-client';

export interface IndexedPassage {
  text: string;
  page?: number;
  section?: string;
}

const embeddings = new LocalEmbeddingProvider({
  cacheDir: process.env.EMBEDDING_CACHE_DIR ?? join(homedir(), '.cache', 'knowguard', 'models'),
  allowRemoteModels: true,
});

/**
 * Uploads a document through the API (real ownership/visibility/ACLs), then indexes the given
 * passages — one chunk each, embedded with the real model — the way the worker does it.
 */
export function createIndexer(api: TestClient, prisma: PrismaService) {
  return async function indexedDocument(
    token: string,
    title: string,
    passages: IndexedPassage[],
    options: { visibility?: string; status?: 'READY' | 'PROCESSING' } = {},
  ): Promise<DocumentDetails> {
    const doc = (
      await api
        .as(token)
        .multipart('/documents')
        .field('title', title)
        .field('visibility', options.visibility ?? 'ORGANIZATION')
        .attach('file', Buffer.from(passages.map((p) => p.text).join('\n\n')), `${randomUUID()}.md`)
        .expect(201)
    ).body as DocumentDetails;
    const vectors = await embeddings.embedDocuments(
      passages.map((p) => `${title}\n${p.section ?? ''}\n\n${p.text}`),
    );
    const organizationId = (await prisma.document.findUniqueOrThrow({ where: { id: doc.id } }))
      .organizationId;
    for (const [index, passage] of passages.entries()) {
      const metadata = {
        pageNumber: passage.page ?? null,
        section: passage.section ?? null,
        headingPath: [],
      };
      await prisma.$executeRaw`
        INSERT INTO document_chunks (id, organization_id, document_id, version_id, chunk_index, content,
          token_count, metadata, embedding, embedding_model)
        VALUES (${randomUUID()}::uuid, ${organizationId}::uuid, ${doc.id}::uuid, ${doc.versions[0]!.id}::uuid,
          ${index}, ${passage.text}, ${Math.ceil(passage.text.length / 4)}, ${JSON.stringify(metadata)}::jsonb,
          ${toVectorLiteral(vectors[index]!)}::vector, ${embeddings.model})`;
    }
    await prisma.document.update({ where: { id: doc.id }, data: { status: options.status ?? 'READY' } });
    return doc;
  };
}

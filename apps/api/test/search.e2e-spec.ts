/**
 * Permission-aware hybrid search against real PostgreSQL + pgvector with the real local models.
 * Documents are uploaded through the API and indexed the way the worker does it (./indexing).
 */
import { randomUUID } from 'node:crypto';
import type { DocumentDetails, SearchResponse } from '@knowguard/types';
import type { INestApplication } from '@nestjs/common';

import type { PrismaService } from '../src/common/prisma.service';
import { createIndexer } from './indexing';
import { createTestApp } from './test-app';
import { TestClient, type TestMember, type TestOwner } from './test-client';

let app: INestApplication;
let prisma: PrismaService;
let api: TestClient;
let owner: TestOwner;
let employee: TestMember;
let outsider: TestOwner;

let indexedDocument: ReturnType<typeof createIndexer>;

const search = (token: string, query: string, limit?: number) =>
  api.as(token).post('/search', { query, ...(limit ? { limit } : {}) });

async function titles(token: string, query: string): Promise<string[]> {
  const body = (await search(token, query).expect(200)).body as SearchResponse;
  return body.results.map((r) => r.title);
}

let rollback: DocumentDetails;

beforeAll(async () => {
  ({ app, prisma } = await createTestApp({ RERANKER_MODEL: 'Xenova/bge-reranker-base' }));
  api = new TestClient(app, prisma);
  indexedDocument = createIndexer(api, prisma);
  owner = await api.registerOwner('Search Org');
  employee = await api.addMember(owner.token, 'EMPLOYEE');
  outsider = await api.registerOwner('Search Outsider');

  rollback = await indexedDocument(owner.token, 'Payments Runbook', [
    {
      text: 'To deploy the payments service, merge to main and promote the release.',
      section: 'Runbook > Deploy',
      page: 1,
    },
    {
      text: 'If smoke tests fail after a release, revert it from the pipeline dashboard within five minutes.',
      section: 'Runbook > Rollback',
      page: 2,
    },
  ]);
  await indexedDocument(owner.token, 'Card Errors', [
    { text: 'Error ERR-4012 means the card issuer declined the payment; ask the customer for another card.' },
  ]);
  await indexedDocument(owner.token, 'Leave Policy', [
    { text: 'Employees receive twenty-five days of annual leave per calendar year.' },
  ]);
  // Highly relevant, but private to the owner.
  await indexedDocument(
    owner.token,
    'Secret Rollback Plan',
    [{ text: 'Confidential: how to revert a failed payments release without telling anyone.' }],
    { visibility: 'PRIVATE' },
  );
  // Still being indexed: not searchable yet.
  await indexedDocument(
    owner.token,
    'Unfinished Draft',
    [{ text: 'Revert the failed payments release draft.' }],
    {
      status: 'PROCESSING',
    },
  );
  // Another tenant with a near-identical passage.
  await indexedDocument(outsider.token, 'Outsider Rollback Guide', [
    { text: 'If smoke tests fail after a release, revert it from the pipeline dashboard.' },
  ]);
}, 180_000);

afterAll(async () => {
  await api?.cleanup();
  await app?.close();
});

describe('relevance', () => {
  it('ranks the document that answers a natural-language question first (semantic)', async () => {
    const body = (await search(employee.token, 'How do I undo a bad payments release?').expect(200))
      .body as SearchResponse;
    expect(body.results[0]).toMatchObject({ documentId: rollback.id, title: 'Payments Runbook', version: 1 });
    expect(body.results[0]!.score).toBeGreaterThan(0);
    expect(body.results[0]!.score).toBeLessThanOrEqual(1);
  });

  it('cites the matching passage: page, section, version and a snippet', async () => {
    const body = (
      await search(employee.token, 'what happens if smoke tests fail after a release').expect(200)
    ).body as SearchResponse;
    expect(body.results[0]).toMatchObject({
      documentId: rollback.id,
      page: 2,
      section: 'Runbook > Rollback',
      versionId: rollback.versions[0]!.id,
    });
    expect(body.results[0]!.snippet).toContain('revert it from the pipeline dashboard');
  });

  it('finds exact identifiers such as error codes (keyword)', async () => {
    expect((await titles(employee.token, 'ERR-4012'))[0]).toBe('Card Errors');
  });

  it('returns at most one result per document, respecting the limit', async () => {
    const body = (await search(employee.token, 'payments release', 2).expect(200)).body as SearchResponse;
    expect(body.results.length).toBeLessThanOrEqual(2);
    const ids = body.results.map((r) => r.documentId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('permissions are applied before retrieval', () => {
  it('never returns a document the caller cannot read — even when it is the best match', async () => {
    const employeeTitles = await titles(employee.token, 'revert a failed payments release confidential');
    expect(employeeTitles).not.toContain('Secret Rollback Plan');
    // The owner can read it, so it is found for them.
    expect(await titles(owner.token, 'revert a failed payments release confidential')).toContain(
      'Secret Rollback Plan',
    );
  });

  it('never returns another organization’s documents', async () => {
    expect(await titles(employee.token, 'smoke tests fail revert pipeline dashboard')).not.toContain(
      'Outsider Rollback Guide',
    );
    const outsiderTitles = await titles(outsider.token, 'smoke tests fail revert pipeline dashboard');
    expect(outsiderTitles).toEqual(['Outsider Rollback Guide']);
  });

  it('respects explicit DENY entries', async () => {
    await api
      .as(owner.token)
      .put(`/documents/${rollback.id}/permissions`, {
        entries: [{ subjectType: 'USER', subjectId: employee.userId, permission: 'READ', effect: 'DENY' }],
      })
      .expect(200);
    expect(await titles(employee.token, 'How do I undo a bad payments release?')).not.toContain(
      'Payments Runbook',
    );
    await api.as(owner.token).put(`/documents/${rollback.id}/permissions`, { entries: [] }).expect(200);
    expect(await titles(employee.token, 'How do I undo a bad payments release?')).toContain(
      'Payments Runbook',
    );
  });

  it('only searches documents that finished indexing', async () => {
    expect(await titles(owner.token, 'failed payments release draft')).not.toContain('Unfinished Draft');
  });
});

describe('validation and access', () => {
  it.each([
    [{ query: '   ' }],
    [{ query: 'x'.repeat(501) }],
    [{ query: 'ok', limit: 0 }],
    [{ query: 'ok', limit: 51 }],
    [{ query: 'ok', organizationId: randomUUID() }],
  ])('rejects %j', async (body) => {
    await api.as(employee.token).post('/search', body).expect(400);
  });

  it('requires authentication and the document.read capability', async () => {
    await api.http().post('/api/v1/search').send({ query: 'anything' }).expect(401);
    const role = (
      await api
        .as(owner.token)
        .post('/roles', { name: 'No Docs', permissions: ['organization.read'] })
        .expect(201)
    ).body;
    const member = await api.addMember(owner.token, 'EMPLOYEE');
    await api
      .as(owner.token)
      .put(`/users/${member.userId}/roles`, { roleKeys: [role.key] })
      .expect(200);
    await search(member.token, 'anything').expect(403);
  });

  it('returns an empty list when nothing readable matches', async () => {
    const fresh = await api.registerOwner('Empty Org');
    expect(((await search(fresh.token, 'payments').expect(200)).body as SearchResponse).results).toEqual([]);
  });
});

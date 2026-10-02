/**
 * Audit logging and analytics end to end (spec §28–29, ADR 0012): what is recorded, what must
 * never be recorded, who may read it, and that records cannot be altered.
 */
import { randomUUID } from 'node:crypto';

import { purgeAuditLogs } from '@knowguard/database';
import type {
  AnalyticsOverview,
  AuditLogPage,
  DocumentDetails,
  DocumentPreviewResponse,
  InviteMemberResponse,
  SessionGrant,
} from '@knowguard/types';
import type { INestApplication } from '@nestjs/common';

import type { PrismaService } from '../src/common/prisma.service';
import { createIndexer } from './indexing';
import { createTestApp, randomIp, uniqueEmail } from './test-app';
import { PASSWORD, TestClient, type TestMember, type TestOwner } from './test-client';

let app: INestApplication;
let prisma: PrismaService;
let api: TestClient;
let owner: TestOwner;
let admin: TestMember;
let employee: TestMember;
let outsider: TestOwner;

const SECRET_QUERY = `zebra-${randomUUID().slice(0, 8)}`;

async function upload(
  token: string,
  title: string,
  options: { visibility?: string; content?: string; filename?: string } = {},
): Promise<DocumentDetails> {
  return (
    await api
      .as(token)
      .multipart('/documents')
      .field('title', title)
      .field('visibility', options.visibility ?? 'ORGANIZATION')
      .attach(
        'file',
        Buffer.from(options.content ?? `# ${title}\n\nBody.`),
        options.filename ?? `${randomUUID()}.md`,
      )
      .expect(201)
  ).body as DocumentDetails;
}

/** Audit rows straight from the database, oldest first. */
async function rows(where: Record<string, unknown>) {
  return prisma.auditLog.findMany({ where, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
}

async function eventually<T>(read: () => Promise<T>, done: (value: T) => boolean): Promise<T> {
  for (let i = 0; i < 40; i += 1) {
    const value = await read();
    if (done(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return read();
}

beforeAll(async () => {
  ({ app, prisma } = await createTestApp({ AI_PROVIDER: 'fake' }));
  api = new TestClient(app, prisma);
  owner = await api.registerOwner('Audit Org');
  admin = await api.addMember(owner.token, 'ADMIN');
  employee = await api.addMember(owner.token, 'EMPLOYEE');
  outsider = await api.registerOwner('Audit Outsider');
}, 120_000);

afterAll(async () => {
  await api?.cleanup();
  await app?.close();
});

describe('document events', () => {
  it('records the full lifecycle with actor, tenant, resource, result and request IP', async () => {
    const doc = await upload(owner.token, 'Lifecycle Doc');
    const as = api.as(owner.token);
    await as.get(`/documents/${doc.id}`).expect(200);
    await as.get(`/documents/${doc.id}`).expect(200); // collapsed into one view
    await as.get(`/documents/${doc.id}/download`).expect(200);
    await as.patch(`/documents/${doc.id}`, { title: 'Lifecycle Doc v2' }).expect(200);
    await as.put(`/documents/${doc.id}/visibility`, { visibility: 'PRIVATE', audienceIds: [] }).expect(200);
    await as
      .put(`/documents/${doc.id}/permissions`, {
        entries: [{ subjectType: 'USER', subjectId: employee.userId, permission: 'READ', effect: 'ALLOW' }],
      })
      .expect(200);
    await as.delete(`/documents/${doc.id}`).expect(204);

    const events = await rows({ resourceId: doc.id, userId: owner.userId });
    expect(events.map((e) => e.action)).toEqual([
      'DOCUMENT_CREATE',
      'DOCUMENT_VIEW',
      'DOCUMENT_DOWNLOAD',
      'DOCUMENT_UPDATE',
      'DOCUMENT_SHARE',
      'PERMISSION_CHANGE',
      'DOCUMENT_DELETE',
    ]);
    for (const event of events) {
      expect(event).toMatchObject({
        organizationId: owner.organizationId,
        resourceType: 'DOCUMENT',
        result: 'SUCCESS',
      });
      expect(event.ip).toBeTruthy();
    }
    expect(events[4]?.metadata).toEqual({
      before: { visibility: 'ORGANIZATION', audienceIds: [] },
      after: { visibility: 'PRIVATE', audienceIds: [] },
    });
    expect(events[5]?.metadata).toEqual({ before: [], after: [`ALLOW READ USER:${employee.userId}`] });
  });

  it('serves bounded previews of text documents and counts them as views', async () => {
    const doc = await upload(owner.token, 'Preview Doc', { content: `# Preview\n\n${'a'.repeat(70_000)}` });
    const body = (await api.as(employee.token).get(`/documents/${doc.id}/preview`).expect(200))
      .body as DocumentPreviewResponse;
    expect(body.preview?.truncated).toBe(true);
    expect(body.preview?.text.length).toBe(64 * 1024);
    await api.as(employee.token).get(`/documents/${doc.id}`).expect(200);
    const views = await rows({ resourceId: doc.id, userId: employee.userId, action: 'DOCUMENT_VIEW' });
    expect(views).toHaveLength(1); // preview + page view within the window = one view
    expect(await rows({ resourceId: doc.id, action: 'DOCUMENT_DOWNLOAD' })).toHaveLength(0);
  });
});

describe('access denied', () => {
  it('records a hidden document as denied while answering 404', async () => {
    const secret = await upload(owner.token, 'Private Plans', { visibility: 'PRIVATE' });
    await api.as(employee.token).get(`/documents/${secret.id}`).expect(404);
    const [denied] = await rows({ resourceId: secret.id, userId: employee.userId });
    expect(denied).toMatchObject({
      action: 'ACCESS_DENIED',
      result: 'DENIED',
      resourceType: 'DOCUMENT',
      metadata: { attempted: 'READ', response: 'NOT_FOUND' },
    });
  });

  it('records a forbidden document action exactly once', async () => {
    const doc = await upload(owner.token, 'Read Only For Employees');
    // A manager holds document.update, so the request reaches the document-level check.
    const manager = await api.addMember(owner.token, 'MANAGER');
    await api.as(manager.token).patch(`/documents/${doc.id}`, { title: 'Hacked' }).expect(403);
    const denied = await rows({ userId: manager.userId, action: 'ACCESS_DENIED' });
    expect(denied).toHaveLength(1);
    expect(denied[0]).toMatchObject({
      resourceType: 'DOCUMENT',
      resourceId: doc.id,
      metadata: { attempted: 'WRITE', response: 'FORBIDDEN' },
    });

    // An employee lacks the capability altogether: refused (and recorded) by the guard.
    await api.as(employee.token).patch(`/documents/${doc.id}`, { title: 'Hacked' }).expect(403);
    const [capability] = await rows({
      userId: employee.userId,
      action: 'ACCESS_DENIED',
      metadata: { path: ['id'], equals: doc.id },
    });
    expect(capability).toMatchObject({
      resourceType: 'ENDPOINT',
      metadata: { required: ['document.update'] },
    });
  });

  it('records missing capabilities and management-rule refusals', async () => {
    const before = new Date();
    await api
      .as(employee.token)
      .post('/roles', { name: 'Sneaky', permissions: ['document.read'] })
      .expect(403);
    await api.as(admin.token).post(`/users/${owner.userId}/suspend`).expect(403);

    const [capability] = await rows({
      userId: employee.userId,
      action: 'ACCESS_DENIED',
      createdAt: { gte: before },
    });
    expect(capability).toMatchObject({
      resourceType: 'ENDPOINT',
      metadata: { reason: 'FORBIDDEN', method: 'POST', route: '/api/v1/roles', required: ['role.create'] },
    });
    const [management] = await rows({
      userId: admin.userId,
      action: 'ACCESS_DENIED',
      createdAt: { gte: before },
    });
    expect(management).toMatchObject({
      resourceType: 'ENDPOINT',
      metadata: { method: 'POST', route: '/api/v1/users/:id/suspend', id: owner.userId },
    });
  });

  it('records attempts to open another member’s conversation', async () => {
    const res = await api.as(owner.token).post('/ai/query', { message: 'hello' }).expect(200);
    const conversationId = /"conversationId":"([^"]+)"/.exec(res.text)?.[1] ?? '';
    await api.as(employee.token).get(`/ai/conversations/${conversationId}`).expect(404);
    const [denied] = await rows({ resourceId: conversationId, action: 'ACCESS_DENIED' });
    expect(denied).toMatchObject({ userId: employee.userId, resourceType: 'CONVERSATION' });
  });
});

describe('people and permissions', () => {
  it('records invitations, joining, role changes and suspension — never the invitation link', async () => {
    const invited = (
      await api
        .as(owner.token)
        .post('/users/invitations', { name: 'Invitee', email: uniqueEmail('invitee'), roleKey: 'EMPLOYEE' })
        .expect(201)
    ).body as InviteMemberResponse;
    const token = invited.invitation.token;
    await api
      .http()
      .post(`/api/v1/invitations/${token}/accept`)
      .set('X-Forwarded-For', randomIp())
      .send({ password: PASSWORD })
      .expect(200);
    const id = invited.member.id;
    await api
      .as(owner.token)
      .put(`/users/${id}/roles`, { roleKeys: ['MANAGER'] })
      .expect(200);
    await api.as(owner.token).post(`/users/${id}/suspend`).expect(200);
    await api.as(owner.token).post(`/users/${id}/suspend`).expect(200); // no change, no event
    await api.as(owner.token).post(`/users/${id}/reactivate`).expect(200);

    const events = await rows({ resourceId: id });
    expect(events.map((e) => [e.action, e.userId])).toEqual([
      ['USER_INVITED', owner.userId],
      ['USER_CREATED', id],
      ['ROLE_CHANGED', owner.userId],
      ['USER_SUSPENDED', owner.userId],
      ['USER_REACTIVATED', owner.userId],
    ]);
    expect(events[2]?.metadata).toEqual({
      before: ['EMPLOYEE'],
      after: ['MANAGER'],
      added: ['MANAGER'],
      removed: ['EMPLOYEE'],
    });
    expect(JSON.stringify(events)).not.toContain(token);
  });

  it('records registration and logins, and failed logins without slowing them down', async () => {
    const email = uniqueEmail('auditor');
    const grant = (
      await api
        .http()
        .post('/api/v1/auth/register')
        .set('X-Forwarded-For', randomIp())
        .send({ name: 'Auditor', email, password: PASSWORD, organizationName: 'Login Audit Org' })
        .expect(201)
    ).body as SessionGrant;
    const me = (await api.as(grant.token).get('/auth/me').expect(200)).body as {
      user: { id: string };
      organization: { id: string };
    };
    api.organizationIds.push(me.organization.id);

    const login = (password: string) =>
      api.http().post('/api/v1/auth/login').set('X-Forwarded-For', randomIp()).send({ email, password });
    await login('definitely wrong!').expect(401);
    await login(PASSWORD).expect(200);

    const events = await eventually(
      () => rows({ organizationId: me.organization.id, userId: me.user.id }),
      (found) => found.length >= 3,
    );
    expect(events.map((e) => e.action).sort()).toEqual(['LOGIN', 'LOGIN_FAILED', 'USER_CREATED']);
    expect(events.find((e) => e.action === 'LOGIN_FAILED')).toMatchObject({
      result: 'FAILURE',
      metadata: { reason: 'INVALID_PASSWORD' },
    });
    expect(JSON.stringify(events)).not.toMatch(/correct horse|definitely wrong/);
  });

  it('records role definition changes and group membership changes', async () => {
    const role = (
      await api
        .as(owner.token)
        .post('/roles', { name: `Auditors ${randomUUID().slice(0, 6)}`, permissions: ['audit.read'] })
        .expect(201)
    ).body as { id: string; key: string };
    await api
      .as(owner.token)
      .patch(`/roles/${role.id}`, { permissions: ['audit.read', 'user.read'] })
      .expect(200);
    await api.as(owner.token).delete(`/roles/${role.id}`).expect(204);
    const roleEvents = await rows({ resourceId: role.id });
    expect(roleEvents.map((e) => (e.metadata as { change: string }).change)).toEqual([
      'ROLE_CREATED',
      'ROLE_UPDATED',
      'ROLE_DELETED',
    ]);
    expect(roleEvents[1]?.metadata).toMatchObject({ added: ['user.read'], removed: [] });

    const department = (
      await api
        .as(owner.token)
        .post('/departments', { name: `Audit Dept ${randomUUID().slice(0, 6)}` })
        .expect(201)
    ).body as { id: string };
    const team = (
      await api
        .as(owner.token)
        .post('/teams', { name: `Audit Team ${randomUUID().slice(0, 6)}`, departmentId: department.id })
        .expect(201)
    ).body as { id: string };
    await api.as(owner.token).put(`/teams/${team.id}/members/${employee.userId}`).expect(204);
    const teamEvents = await rows({ resourceId: team.id });
    expect(teamEvents.map((e) => [e.action, (e.metadata as { change: string }).change])).toEqual([
      ['GROUP_CHANGED', 'CREATED'],
      ['GROUP_CHANGED', 'MEMBER_ADDED'],
    ]);
  });
});

describe('search and Ask AI', () => {
  it('records searches and questions without their text', async () => {
    const index = createIndexer(api, prisma);
    await index(owner.token, 'Zebra Handbook', [{ text: `The ${SECRET_QUERY} enclosure opens at nine.` }]);
    const before = new Date();
    await api.as(employee.token).post('/search', { query: SECRET_QUERY }).expect(200);
    await api
      .as(employee.token)
      .post('/ai/query', { message: `When does the ${SECRET_QUERY} open?` })
      .expect(200);

    const events = await rows({ userId: employee.userId, createdAt: { gte: before } });
    const search = events.find((e) => e.action === 'SEARCH');
    const question = events.find((e) => e.action === 'AI_QUERY');
    expect(search?.metadata).toMatchObject({ results: 1 });
    expect(question).toMatchObject({ resourceType: 'CONVERSATION', result: 'SUCCESS' });
    expect(question?.metadata).toMatchObject({
      outcome: 'ANSWERED',
      model: 'test/fake-chat',
      sourceCount: 1,
    });
    expect(JSON.stringify(events)).not.toContain(SECRET_QUERY);
  });
});

describe('reading the audit log', () => {
  const page = (token: string, query = '') => api.as(token).get(`/audit-logs${query}`);

  it('requires audit.read — and the refusal is itself audited', async () => {
    await page(employee.token).expect(403);
    const [denied] = await rows({
      userId: employee.userId,
      action: 'ACCESS_DENIED',
      metadata: { path: ['route'], equals: '/api/v1/audit-logs' },
    });
    expect(denied).toMatchObject({ metadata: { required: ['audit.read'] } });
  });

  it('is scoped to the caller’s organization', async () => {
    const own = (await page(outsider.token, '?limit=100').expect(200)).body as AuditLogPage;
    expect(own.entries.length).toBeGreaterThan(0);
    const orgUsers = new Set([owner.userId, admin.userId, employee.userId]);
    expect(own.entries.some((e) => e.actor && orgUsers.has(e.actor.id))).toBe(false);
    // Filtering by another tenant's user or resource finds nothing.
    const probe = (await page(outsider.token, `?userId=${owner.userId}`).expect(200)).body as AuditLogPage;
    expect(probe.entries).toEqual([]);
  });

  it('filters and pages newest first', async () => {
    const first = (await page(owner.token, `?userId=${owner.userId}&limit=2`).expect(200))
      .body as AuditLogPage;
    expect(first.entries).toHaveLength(2);
    expect(first.nextCursor).toBeTruthy();
    const second = (
      await page(owner.token, `?userId=${owner.userId}&limit=2&cursor=${first.nextCursor}`).expect(200)
    ).body as AuditLogPage;
    expect((second.entries[0]?.createdAt ?? '') <= (first.entries[1]?.createdAt ?? '')).toBe(true);
    expect(new Set([...first.entries, ...second.entries].map((e) => e.id)).size).toBe(4);

    const denied = (await page(owner.token, '?action=ACCESS_DENIED&result=DENIED').expect(200))
      .body as AuditLogPage;
    expect(denied.entries.length).toBeGreaterThan(0);
    expect(denied.entries.every((e) => e.action === 'ACCESS_DENIED')).toBe(true);
    expect(denied.entries[0]?.actor?.email).toBeTruthy();
  });

  it('never reveals titles of documents the reviewer cannot read', async () => {
    const secret = await upload(owner.token, 'Layoff Plan Q3', { visibility: 'PRIVATE' });
    const forOwner = (await page(owner.token, `?resourceId=${secret.id}`).expect(200)).body as AuditLogPage;
    expect(forOwner.entries[0]?.resourceLabel).toBe('Layoff Plan Q3');
    const forAdmin = (await page(admin.token, `?resourceId=${secret.id}`).expect(200)).body as AuditLogPage;
    expect(forAdmin.entries[0]).toMatchObject({ action: 'DOCUMENT_CREATE', resourceLabel: null });
    expect(JSON.stringify(forAdmin)).not.toContain('Layoff');
  });

  it.each([['?action=DROP'], ['?limit=500'], ['?organizationId=' + randomUUID()], ['?from=yesterday']])(
    'rejects %s',
    async (query) => {
      await page(owner.token, query).expect(400);
    },
  );
});

describe('integrity', () => {
  it('cannot be changed or deleted, except through the explicit purge path', async () => {
    const [entry] = await rows({ organizationId: owner.organizationId });
    if (!entry) throw new Error('expected audit entries');
    await expect(
      prisma.auditLog.update({ where: { id: entry.id }, data: { result: 'DENIED' } }),
    ).rejects.toThrow(/append-only/);
    await expect(prisma.auditLog.delete({ where: { id: entry.id } })).rejects.toThrow(/append-only/);
    await expect(prisma.$executeRawUnsafe('TRUNCATE audit_logs')).rejects.toThrow(/append-only/);

    const throwaway = await api.registerOwner('Purge Org');
    expect(await purgeAuditLogs(prisma, { organizationId: throwaway.organizationId })).toBeGreaterThan(0);
  });
});

describe('analytics', () => {
  it('summarizes activity, AI usage and top documents for the organization', async () => {
    const res = await api.as(owner.token).get('/analytics/overview?days=7').expect(200);
    const overview = res.body as AnalyticsOverview;
    expect(overview.days).toBe(7);
    expect(overview.activity).toHaveLength(7);
    expect(overview.activity.at(-1)?.date).toBe(new Date().toISOString().slice(0, 10));
    const total = (field: 'searches' | 'aiQueries' | 'views' | 'uploads' | 'denied') =>
      overview.activity.reduce((n, d) => n + d[field], 0);
    expect(total('searches')).toBeGreaterThanOrEqual(1);
    expect(total('aiQueries')).toBeGreaterThanOrEqual(2);
    expect(total('views')).toBeGreaterThanOrEqual(2);
    expect(total('uploads')).toBeGreaterThanOrEqual(5);
    expect(total('denied')).toBeGreaterThanOrEqual(4);
    expect(overview.members.active).toBeGreaterThanOrEqual(3);
    expect(overview.ai.questions).toBe(overview.ai.answered + overview.ai.notFound + overview.ai.failed);
    expect(overview.topUsers[0]?.user.email).toBeTruthy();
  });

  it('hides titles of top documents the viewer cannot read', async () => {
    const secret = await upload(owner.token, 'Board Only', { visibility: 'PRIVATE' });
    for (let i = 0; i < 3; i += 1)
      await api.as(owner.token).get(`/documents/${secret.id}/download`).expect(200);
    await api.as(owner.token).get(`/documents/${secret.id}`).expect(200);
    const forAdmin = (await api.as(admin.token).get('/analytics/overview').expect(200))
      .body as AnalyticsOverview;
    const entry = forAdmin.topDocuments.find((d) => d.documentId === secret.id);
    expect(entry).toMatchObject({ title: null, views: 1 });
    expect(JSON.stringify(forAdmin)).not.toContain('Board Only');
  });

  it('requires audit.read and validates the period', async () => {
    await api.as(employee.token).get('/analytics/overview').expect(403);
    await api.as(owner.token).get('/analytics/overview?days=45').expect(400);
  });
});

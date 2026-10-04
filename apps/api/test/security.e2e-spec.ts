/**
 * Security regression suite (Phase 10, ADR 0013). The sweeps iterate over EVERY route the
 * application exposes (read from decorator metadata), so endpoints added later are covered
 * automatically:
 *
 *  - route policy: a route is public only if listed here, and otherwise declares a capability;
 *  - unauthenticated requests are refused everywhere;
 *  - members without a route's capability are refused, for every built-in role;
 *  - IDs belonging to another organization behave exactly like IDs that do not exist.
 */
import { randomUUID } from 'node:crypto';

import { SYSTEM_ROLES } from '@knowguard/authorization';
import type { DocumentDetails } from '@knowguard/types';
import type { INestApplication } from '@nestjs/common';
import type { Test as SupertestRequest } from 'supertest';

import type { PrismaService } from '../src/common/prisma.service';
import { listRoutes, type Route, routeName } from './route-inventory';
import { createTestApp } from './test-app';
import { TestClient, type TestMember, type TestOwner } from './test-client';

/** The only routes reachable without a session. Adding one is a deliberate, reviewed change. */
const PUBLIC_ROUTES = [
  'GET /api/v1/health',
  'POST /api/v1/auth/login',
  'POST /api/v1/auth/register',
  'GET /api/v1/invitations/:token',
  'POST /api/v1/invitations/:token/accept',
].sort();

/** Authenticated routes that need no capability: they only ever touch the caller's own session. */
const SESSION_ONLY_ROUTES = ['GET /api/v1/auth/me', 'POST /api/v1/auth/logout'].sort();

let app: INestApplication;
let prisma: PrismaService;
let api: TestClient;
let routes: Route[];

beforeAll(async () => {
  ({ app, prisma } = await createTestApp({ AI_PROVIDER: 'fake' }));
  api = new TestClient(app, prisma);
  routes = listRoutes(app);
}, 60_000);

afterAll(async () => {
  await api?.cleanup();
  await app?.close();
});

/** Fills every :param with a well-formed ID, so requests reach the guard, not the router's 404. */
const withDummyParams = (path: string) =>
  path.replace(/:token/g, 'x'.repeat(43)).replace(/:\w+/g, randomUUID());

function send(request: ReturnType<TestClient['http']>, route: Route, path: string): SupertestRequest {
  const verb = route.method.toLowerCase() as 'get' | 'post' | 'put' | 'patch' | 'delete';
  return request[verb](path);
}

describe('route policy', () => {
  it('exposes only the reviewed public routes', () => {
    expect(
      routes
        .filter((r) => r.isPublic)
        .map(routeName)
        .sort(),
    ).toEqual(PUBLIC_ROUTES);
  });

  it('requires a capability on every other route (except session-only routes)', () => {
    const withoutCapability = routes.filter((r) => !r.isPublic && r.permissions.length === 0).map(routeName);
    expect(withoutCapability.sort()).toEqual(SESSION_ONLY_ROUTES);
  });

  it('found a plausible number of routes (guards against a broken inventory)', () => {
    expect(routes.length).toBeGreaterThan(40);
  });
});

describe('authentication is required everywhere else', () => {
  it.each([
    ['no credentials', undefined],
    ['a malformed token', 'Bearer not-a-token'],
    ['a well-formed but unknown token', `Bearer ${'A'.repeat(43)}`],
  ])('refuses every protected route with %s', async (_label, authorization) => {
    const failures: string[] = [];
    for (const route of routes.filter((r) => !r.isPublic)) {
      let request = send(api.http(), route, withDummyParams(route.path));
      if (authorization) request = request.set('Authorization', authorization);
      const res = await request.send({});
      if (res.status !== 401 || res.body?.error?.code !== 'UNAUTHENTICATED') {
        failures.push(`${routeName(route)} → ${res.status}`);
      }
    }
    expect(failures).toEqual([]);
  });
});

describe('capabilities are enforced on every route', () => {
  const roles = [
    ...SYSTEM_ROLES.filter((role) => role.key !== 'OWNER').map((role) => ({
      label: role.key,
      roleKey: role.key,
      permissions: role.permissions as readonly string[],
    })),
    { label: 'custom role with only organization.read', roleKey: null, permissions: ['organization.read'] },
  ];

  it.each(roles)('refuses routes $label lacks', async ({ roleKey, permissions }) => {
    const owner = await api.registerOwner('Capability Org');
    const member = await api.addMember(owner.token, roleKey ?? 'EMPLOYEE');
    if (!roleKey) {
      const role = (
        await api
          .as(owner.token)
          .post('/roles', { name: `Minimal ${randomUUID().slice(0, 6)}`, permissions })
          .expect(201)
      ).body as { key: string };
      await api
        .as(owner.token)
        .put(`/users/${member.userId}/roles`, { roleKeys: [role.key] })
        .expect(200);
    }

    const lacking = routes.filter(
      (r) => !r.isPublic && r.permissions.some((permission) => !permissions.includes(permission)),
    );
    expect(lacking.length).toBeGreaterThan(0);
    const failures: string[] = [];
    for (const route of lacking) {
      const res = await send(api.http(), route, withDummyParams(route.path))
        .set('Authorization', `Bearer ${member.token}`)
        .send({});
      if (res.status !== 403 || res.body?.error?.code !== 'FORBIDDEN')
        failures.push(`${routeName(route)} → ${res.status}`);
    }
    expect(failures).toEqual([]);
  });
});

describe('tenant isolation', () => {
  let victim: TestOwner;
  let victimMember: TestMember;
  let attacker: TestOwner;
  let attackerMember: TestMember;
  let ids: {
    document: DocumentDetails;
    department: string;
    team: string;
    role: { id: string; key: string };
    conversation: string;
  };
  let own: { document: DocumentDetails; department: string; team: string };

  async function upload(token: string, title: string): Promise<DocumentDetails> {
    return (
      await api
        .as(token)
        .multipart('/documents')
        .field('title', title)
        .field('visibility', 'ORGANIZATION')
        .attach('file', Buffer.from(`# ${title}\n\nVictim content.`), `${randomUUID()}.md`)
        .expect(201)
    ).body as DocumentDetails;
  }

  async function groups(token: string) {
    const department = (
      await api
        .as(token)
        .post('/departments', { name: `Dept ${randomUUID().slice(0, 6)}` })
        .expect(201)
    ).body as { id: string };
    const team = (
      await api
        .as(token)
        .post('/teams', { name: `Team ${randomUUID().slice(0, 6)}`, departmentId: department.id })
        .expect(201)
    ).body as { id: string };
    return { department: department.id, team: team.id };
  }

  beforeAll(async () => {
    victim = await api.registerOwner('Victim Org');
    victimMember = await api.addMember(victim.token, 'EMPLOYEE');
    attacker = await api.registerOwner('Attacker Org'); // OWNER: holds every capability
    attackerMember = await api.addMember(attacker.token, 'EMPLOYEE');

    const role = (
      await api
        .as(victim.token)
        .post('/roles', { name: `Victim Role ${randomUUID().slice(0, 6)}`, permissions: ['document.read'] })
        .expect(201)
    ).body as { id: string; key: string };
    const answer = await api.as(victim.token).post('/ai/query', { message: 'hello' }).expect(200);
    ids = {
      document: await upload(victim.token, 'Victim Payroll'),
      ...(await groups(victim.token)),
      role,
      conversation: /"conversationId":"([^"]+)"/.exec(answer.text)?.[1] ?? '',
    };
    own = { document: await upload(attacker.token, 'Attacker Doc'), ...(await groups(attacker.token)) };
  }, 120_000);

  /**
   * How each parameterised route is probed with the victim's IDs. Every such route must be
   * listed (the test fails otherwise), so new endpoints get a deliberate cross-tenant case.
   */
  function victimCase(route: Route): { path: string; body?: object; attach?: boolean } | null {
    const d = ids.document;
    const cases: Record<string, { path: string; body?: object; attach?: boolean }> = {
      'DELETE /api/v1/ai/conversations/:id': { path: `/ai/conversations/${ids.conversation}` },
      'GET /api/v1/ai/conversations/:id': { path: `/ai/conversations/${ids.conversation}` },
      'DELETE /api/v1/departments/:id': { path: `/departments/${ids.department}` },
      'PATCH /api/v1/departments/:id': { path: `/departments/${ids.department}`, body: { name: 'Pwned' } },
      'DELETE /api/v1/departments/:id/members/:userId': {
        path: `/departments/${ids.department}/members/${victimMember.userId}`,
      },
      'PUT /api/v1/departments/:id/members/:userId': {
        path: `/departments/${ids.department}/members/${attackerMember.userId}`,
      },
      'DELETE /api/v1/documents/:id': { path: `/documents/${d.id}` },
      'GET /api/v1/documents/:id': { path: `/documents/${d.id}` },
      'PATCH /api/v1/documents/:id': { path: `/documents/${d.id}`, body: { title: 'Pwned' } },
      'GET /api/v1/documents/:id/download': { path: `/documents/${d.id}/download` },
      'PUT /api/v1/documents/:id/permissions': {
        path: `/documents/${d.id}/permissions`,
        body: {
          entries: [{ subjectType: 'USER', subjectId: attacker.userId, permission: 'READ', effect: 'ALLOW' }],
        },
      },
      'GET /api/v1/documents/:id/preview': { path: `/documents/${d.id}/preview` },
      'POST /api/v1/documents/:id/reindex': { path: `/documents/${d.id}/reindex` },
      'POST /api/v1/documents/:id/versions': { path: `/documents/${d.id}/versions`, attach: true },
      'GET /api/v1/documents/:id/versions/:versionId/download': {
        path: `/documents/${d.id}/versions/${d.versions[0]?.id}/download`,
      },
      'PUT /api/v1/documents/:id/visibility': {
        path: `/documents/${d.id}/visibility`,
        body: { visibility: 'PRIVATE', audienceIds: [] },
      },
      'DELETE /api/v1/roles/:id': { path: `/roles/${ids.role.id}` },
      'PATCH /api/v1/roles/:id': { path: `/roles/${ids.role.id}`, body: { name: 'Pwned Role' } },
      'DELETE /api/v1/teams/:id': { path: `/teams/${ids.team}` },
      'PATCH /api/v1/teams/:id': { path: `/teams/${ids.team}`, body: { name: 'Pwned' } },
      'DELETE /api/v1/teams/:id/members/:userId': {
        path: `/teams/${ids.team}/members/${victimMember.userId}`,
      },
      'PUT /api/v1/teams/:id/members/:userId': {
        path: `/teams/${ids.team}/members/${attackerMember.userId}`,
      },
      'GET /api/v1/users/:id': { path: `/users/${victimMember.userId}` },
      'POST /api/v1/users/:id/invitations': { path: `/users/${victimMember.userId}/invitations` },
      'POST /api/v1/users/:id/reactivate': { path: `/users/${victimMember.userId}/reactivate` },
      'PUT /api/v1/users/:id/roles': {
        path: `/users/${victimMember.userId}/roles`,
        body: { roleKeys: ['ADMIN'] },
      },
      'POST /api/v1/users/:id/suspend': { path: `/users/${victimMember.userId}/suspend` },
    };
    return cases[routeName(route)] ?? null;
  }

  it('answers 404 for every route given another organization’s IDs — even as its owner', async () => {
    const parameterised = routes.filter((r) => !r.isPublic && r.path.includes(':'));
    const missingCases = parameterised.filter((r) => !victimCase(r)).map(routeName);
    expect(missingCases).toEqual([]); // add a case above for each new parameterised route

    const failures: string[] = [];
    for (const route of parameterised) {
      const probe = victimCase(route)!;
      let request = send(api.http(), route, `/api/v1${probe.path}`).set(
        'Authorization',
        `Bearer ${attacker.token}`,
      );
      if (probe.attach) {
        request = request.attach('file', Buffer.from('# overwritten'), 'x.md');
      } else {
        request = request.send(probe.body ?? {});
      }
      const res = await request;
      if (res.status !== 404)
        failures.push(`${routeName(route)} → ${res.status} ${JSON.stringify(res.body)}`);
    }
    expect(failures).toEqual([]);
  });

  it('left the victim’s data untouched', async () => {
    const doc = (await api.as(victim.token).get(`/documents/${ids.document.id}`).expect(200))
      .body as DocumentDetails;
    expect(doc).toMatchObject({ title: 'Victim Payroll', visibility: 'ORGANIZATION', version: 1 });
    expect(doc.acl).toEqual([]);
    const member = (await api.as(victim.token).get(`/users/${victimMember.userId}`).expect(200)).body as {
      status: string;
      roles: string[];
    };
    expect(member).toMatchObject({ status: 'ACTIVE', roles: ['EMPLOYEE'] });
    await api.as(victim.token).get(`/ai/conversations/${ids.conversation}`).expect(200);
    expect(await prisma.role.count({ where: { id: ids.role.id, name: { startsWith: 'Victim Role' } } })).toBe(
      1,
    );
  });

  it('refuses another organization’s IDs inside request bodies', async () => {
    const as = api.as(attacker.token);
    // Sharing one's own document with a foreign user, role, team or department.
    for (const [subjectType, subjectId] of [
      ['USER', victimMember.userId],
      ['ROLE', ids.role.id],
      ['TEAM', ids.team],
      ['DEPARTMENT', ids.department],
    ] as const) {
      const res = await as.put(`/documents/${own.document.id}/permissions`, {
        entries: [{ subjectType, subjectId, permission: 'READ', effect: 'ALLOW' }],
      });
      expect([res.status, res.body.error?.code]).toEqual([400, 'UNKNOWN_SUBJECT']);
    }
    // Audiences, team parents and role keys from another organization.
    const visibility = await as.put(`/documents/${own.document.id}/visibility`, {
      visibility: 'TEAM',
      audienceIds: [ids.team],
    });
    expect([visibility.status, visibility.body.error?.code]).toEqual([400, 'UNKNOWN_SUBJECT']);
    await as.post('/teams', { name: 'Smuggled', departmentId: ids.department }).expect(404);
    await as.put(`/users/${attackerMember.userId}/roles`, { roleKeys: [ids.role.key] }).expect(404);
    // Ask AI scoped to a foreign document or continuing a foreign conversation.
    await as.post('/ai/query', { message: 'hi', documentId: ids.document.id }).expect(404);
    await as.post('/ai/query', { message: 'hi', conversationId: ids.conversation }).expect(404);
    // Audit and analytics never show another organization's events.
    const audit = (await as.get(`/audit-logs?resourceId=${ids.document.id}`).expect(200)).body as {
      entries: unknown[];
    };
    expect(audit.entries).toEqual([]);
    const byUser = (await as.get(`/audit-logs?userId=${victim.userId}`).expect(200)).body as {
      entries: unknown[];
    };
    expect(byUser.entries).toEqual([]);
  });

  it('never lists or searches another organization’s data', async () => {
    const as = api.as(attacker.token);
    const lists = await Promise.all([
      as.get('/documents?pageSize=100'),
      as.get('/users'),
      as.get('/roles'),
      as.get('/teams'),
      as.get('/departments'),
      as.get('/ai/conversations'),
      as.get('/audit-logs?limit=100'),
      as.post('/search', { query: 'payroll victim content' }), // no title text: the query is echoed
    ]);
    const leaked = [
      ids.document.id,
      victimMember.userId,
      victim.userId,
      ids.role.id,
      ids.team,
      ids.department,
      ids.conversation,
    ];
    for (const res of lists) {
      expect(res.status).toBe(200);
      for (const id of leaked) expect(res.text).not.toContain(id);
      expect(res.text).not.toContain('Victim Payroll');
    }
  });
});

describe('per-member API rate limit', () => {
  let limited: INestApplication;
  let limitedApi: TestClient;

  beforeAll(async () => {
    ({ app: limited } = await createTestApp({
      API_RATE_LIMIT_PER_MINUTE: '30',
      API_WRITE_RATE_LIMIT_PER_MINUTE: '5',
    }));
    limitedApi = new TestClient(limited, prisma);
  });
  afterAll(async () => {
    await limitedApi?.cleanup();
    await limited?.close();
  });

  it('limits changes and all requests per member, independently for each member', async () => {
    const owner = await limitedApi.registerOwner('Limited Org');
    const other = await limitedApi.addMember(owner.token, 'ADMIN'); // the invite itself is owner write #1
    const as = limitedApi.as(owner.token);
    for (let i = 0; i < 4; i += 1) {
      await as.post('/departments', { name: `Dept ${i} ${randomUUID().slice(0, 4)}` }).expect(201);
    }
    const blocked = await as.post('/departments', { name: 'One too many' }).expect(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    // Reads have their own, larger budget; other members are unaffected.
    await as.get('/departments').expect(200);
    await limitedApi
      .as(other.token)
      .post('/departments', { name: `Other ${randomUUID().slice(0, 4)}` })
      .expect(201);

    let status = 200;
    for (let i = 0; i < 40 && status === 200; i += 1) status = (await as.get('/auth/me')).status;
    expect(status).toBe(429);
  });
});

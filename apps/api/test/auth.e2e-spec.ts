import { createHash } from 'node:crypto';

import { PERMISSION_KEYS } from '@knowguard/authorization';
import { purgeAuditLogs } from '@knowguard/database';
import type { MeResponse, SessionGrant } from '@knowguard/types';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import type { PrismaService } from '../src/common/prisma.service';
import { createTestApp, randomIp, uniqueEmail } from './test-app';

let app: INestApplication;
let prisma: PrismaService;
const createdUserIds: string[] = [];
const createdOrgIds: string[] = [];

const PASSWORD = 'correct horse battery staple';
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

const http = () => request(app.getHttpServer());

async function register(overrides: Record<string, unknown> = {}, ip = randomIp()) {
  const email = uniqueEmail('reg');
  const body = { name: 'Test User', email, password: PASSWORD, organizationName: 'E2E Org', ...overrides };
  const res = await http().post('/api/v1/auth/register').set('X-Forwarded-For', ip).send(body);
  if (res.status === 201) {
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: String(body.email).toLowerCase() },
      include: { memberships: true },
    });
    createdUserIds.push(user.id);
    createdOrgIds.push(...user.memberships.map((m) => m.organizationId));
  }
  return { res, email: String(body.email).toLowerCase(), grant: res.body as SessionGrant };
}

const login = (email: string, password: string, ip = randomIp()) =>
  http().post('/api/v1/auth/login').set('X-Forwarded-For', ip).send({ email, password });

const me = (token?: string) => {
  const req = http().get('/api/v1/auth/me');
  return token ? req.set('Authorization', `Bearer ${token}`) : req;
};

beforeAll(async () => {
  ({ app, prisma } = await createTestApp());
});

afterAll(async () => {
  if (prisma) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    const where = { organizationId: { in: createdOrgIds } };
    await prisma.role.deleteMany({ where });
    await purgeAuditLogs(prisma, { organizationId: { in: createdOrgIds } });
    await prisma.organization.deleteMany({ where: { id: { in: createdOrgIds } } });
  }
  await app?.close();
});

describe('POST /auth/register', () => {
  it('creates a user, a new organization with OWNER membership, and a session', async () => {
    const { res, email, grant } = await register({ organizationName: 'Globex Research' });
    expect(res.status).toBe(201);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(grant.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(new Date(grant.expiresAt).getTime()).toBeGreaterThan(Date.now());

    const user = await prisma.user.findUniqueOrThrow({
      where: { email },
      include: {
        memberships: { include: { organization: true, roles: { include: { role: true } } } },
        sessions: true,
      },
    });
    expect(user.status).toBe('ACTIVE');
    expect(user.emailVerifiedAt).toBeNull();
    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
    expect(user.memberships).toHaveLength(1);
    const membership = user.memberships[0]!;
    expect(membership.status).toBe('ACTIVE');
    expect(membership.organization.name).toBe('Globex Research');
    expect(membership.organization.slug).toMatch(/^globex-research(-[a-z0-9]{6})?$/);
    expect(membership.roles.map((r) => r.role.key)).toEqual(['OWNER']);
    expect(await prisma.role.count({ where: { organizationId: membership.organizationId } })).toBe(4);
  });

  it('stores only the SHA-256 hash of the session token', async () => {
    const { email, grant } = await register();
    const sessions = await prisma.session.findMany({ where: { user: { email } } });
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.tokenHash).toBe(sha256(grant.token));
    expect(JSON.stringify(sessions)).not.toContain(grant.token);
  });

  it('gives organizations with the same name distinct slugs', async () => {
    const a = await register({ organizationName: 'Same Name Ltd' });
    const b = await register({ organizationName: 'Same Name Ltd' });
    const [meA, meB] = await Promise.all([me(a.grant.token), me(b.grant.token)]);
    expect((meA.body as MeResponse).organization.slug).not.toBe((meB.body as MeResponse).organization.slug);
  });

  it.each(['organizationId', 'role', 'status', 'emailVerifiedAt'])(
    'rejects a client-supplied %s instead of trusting it',
    async (field) => {
      const { res } = await register({ [field]: 'attacker-controlled' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
      expect(JSON.stringify(res.body)).not.toContain('attacker-controlled');
    },
  );

  it('validates input and reports fields without echoing values', async () => {
    const { res } = await register({ email: 'not-an-email', password: 'short' });
    expect(res.status).toBe(400);
    const paths = (res.body.error.details as Array<{ path: string }>).map((d) => d.path).sort();
    expect(paths).toEqual(['email', 'password']);
    expect(JSON.stringify(res.body)).not.toContain('not-an-email');
  });

  it('rejects a duplicate email (case-insensitively) with 409', async () => {
    const first = await register();
    const { res } = await register({ email: first.email.toUpperCase() });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_UNAVAILABLE');
  });

  it('rate-limits registrations per client IP', async () => {
    const ip = randomIp();
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push((await register({}, ip)).res.status);
    expect(statuses.slice(0, 5)).toEqual([201, 201, 201, 201, 201]);
    expect(statuses[5]).toBe(429);
  });
});

describe('GET /auth/me', () => {
  it('returns the principal and tenant derived from the session', async () => {
    const { email, grant } = await register({ name: 'Grace Hopper', organizationName: 'Compiler Co' });
    const res = await me(grant.token).expect(200);
    const body = res.body as MeResponse;
    expect(body.user).toMatchObject({ email, name: 'Grace Hopper', emailVerified: false });
    expect(body.organization.name).toBe('Compiler Co');
    expect(body.roles).toEqual(['OWNER']);
    expect(body.permissions).toEqual([...PERMISSION_KEYS].sort()); // OWNER holds the whole catalog
    expect(body.session.expiresAt).toBe(grant.expiresAt);
    expect(JSON.stringify(body)).not.toMatch(/passwordHash|argon2|tokenHash/);
  });

  it('isolates tenants: each session only ever sees its own organization', async () => {
    const a = await register({ organizationName: 'Tenant Alpha' });
    const b = await register({ organizationName: 'Tenant Beta' });
    const [meA, meB] = [
      (await me(a.grant.token)).body as MeResponse,
      (await me(b.grant.token)).body as MeResponse,
    ];
    expect(meA.organization.name).toBe('Tenant Alpha');
    expect(meB.organization.name).toBe('Tenant Beta');
    expect(meA.organization.id).not.toBe(meB.organization.id);
  });

  it.each([
    ['no Authorization header', undefined],
    ['a well-formed but unknown token', 'x'.repeat(43)],
    ['a malformed token', 'not a token'],
  ])('rejects %s with UNAUTHENTICATED', async (_label, token) => {
    const res = await me(token).expect(401);
    expect(res.body).toEqual({ error: { code: 'UNAUTHENTICATED', message: 'Authentication is required.' } });
  });

  it('ignores session cookies sent directly to the API (bearer from the BFF only)', async () => {
    const { grant } = await register();
    await http().get('/api/v1/auth/me').set('Cookie', `kg_session=${grant.token}`).expect(401);
  });
});

describe('POST /auth/login', () => {
  it('issues a fresh session for valid credentials (case-insensitive email)', async () => {
    const { email, grant } = await register();
    const res = await login(email.toUpperCase(), PASSWORD).expect(200);
    const second = res.body as SessionGrant;
    expect(second.token).not.toBe(grant.token);
    await me(second.token).expect(200);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.lastLoginAt).not.toBeNull();
  });

  it('returns byte-identical responses for unknown email and wrong password', async () => {
    const { email } = await register();
    const wrongPassword = await login(email, 'definitely wrong pw');
    const unknownEmail = await login(uniqueEmail('ghost'), PASSWORD);
    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body).toEqual({
      error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' },
    });
    expect(unknownEmail.body).toEqual(wrongPassword.body);
  });

  it('locks an email after repeated failures — from any IP, and even for the right password', async () => {
    const { email } = await register();
    for (let i = 0; i < 10; i++) await login(email, `wrong password ${i}`).expect(401);
    const locked = await login(email, PASSWORD).expect(429);
    expect(locked.body.error.code).toBe('RATE_LIMITED');
    expect(Number(locked.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('cannot be overshot by concurrent guesses (attempts are counted atomically)', async () => {
    const { email } = await register();
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) => login(email, `parallel guess ${i}`)),
    );
    const statuses = results.map((res) => res.status).sort();
    expect(statuses.filter((s) => s === 401)).toHaveLength(10);
    expect(statuses.filter((s) => s === 429)).toHaveLength(10);
  });

  it('a successful login resets the per-email attempt counter', async () => {
    const { email } = await register();
    for (let i = 0; i < 9; i++) await login(email, `typo ${i}`).expect(401);
    await login(email, PASSWORD).expect(200);
    for (let i = 0; i < 9; i++) await login(email, `typo again ${i}`).expect(401);
    await login(email, PASSWORD).expect(200);
  });

  it('locks unknown emails exactly like known ones (no enumeration via lockout)', async () => {
    const ghost = uniqueEmail('ghost');
    for (let i = 0; i < 10; i++) await login(ghost, `wrong password ${i}`).expect(401);
    await login(ghost, PASSWORD).expect(429);
  });

  it('rate-limits login attempts per client IP', async () => {
    const ip = randomIp();
    for (let i = 0; i < 30; i++) await login(uniqueEmail('spray'), PASSWORD, ip).expect(401);
    await login(uniqueEmail('spray'), PASSWORD, ip).expect(429);
    // A different client is unaffected.
    await login(uniqueEmail('spray'), PASSWORD).expect(401);
  });
});

describe('POST /auth/logout', () => {
  it('revokes the session immediately', async () => {
    const { grant } = await register();
    await me(grant.token).expect(200);
    await http().post('/api/v1/auth/logout').set('Authorization', `Bearer ${grant.token}`).expect(204);
    await me(grant.token).expect(401);
    const session = await prisma.session.findUniqueOrThrow({ where: { tokenHash: sha256(grant.token) } });
    expect(session.revokedAt).not.toBeNull();
    expect(session.revokedReason).toBe('logout');
  });

  it('requires authentication', async () => {
    await http().post('/api/v1/auth/logout').expect(401);
  });

  it('only revokes the current session, not other devices', async () => {
    const { email, grant } = await register();
    const other = (await login(email, PASSWORD).expect(200)).body as SessionGrant;
    await http().post('/api/v1/auth/logout').set('Authorization', `Bearer ${grant.token}`).expect(204);
    await me(other.token).expect(200);
  });
});

describe('account state enforcement', () => {
  it('suspending a user invalidates existing sessions and blocks login', async () => {
    const { email, grant } = await register();
    await me(grant.token).expect(200);
    await prisma.user.update({ where: { email }, data: { status: 'SUSPENDED' } });

    await me(grant.token).expect(401);
    const session = await prisma.session.findUniqueOrThrow({ where: { tokenHash: sha256(grant.token) } });
    expect(session.revokedReason).toBe('account_inactive');

    const res = await login(email, PASSWORD).expect(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS'); // no "account suspended" disclosure
  });

  it('suspending a membership invalidates sessions for that organization', async () => {
    const { email, grant } = await register();
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    await prisma.userOrganization.updateMany({ where: { userId: user.id }, data: { status: 'SUSPENDED' } });
    await me(grant.token).expect(401);
    await login(email, PASSWORD).expect(401);
  });

  it('rejects expired sessions', async () => {
    const { grant } = await register();
    await prisma.session.update({
      where: { tokenHash: sha256(grant.token) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await me(grant.token).expect(401);
  });

  it('rejects idle sessions', async () => {
    const { grant } = await register();
    await prisma.session.update({
      where: { tokenHash: sha256(grant.token) },
      data: { lastSeenAt: new Date(Date.now() - 25 * 60 * 60 * 1000) },
    });
    await me(grant.token).expect(401);
  });
});

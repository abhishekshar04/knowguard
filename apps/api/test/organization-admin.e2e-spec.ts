import { createHash } from 'node:crypto';

import { purgeAuditLogs } from '@knowguard/database';
import type {
  DepartmentDetails,
  InviteMemberResponse,
  MeResponse,
  MemberListResponse,
  MemberSummary,
  RoleListResponse,
  SessionGrant,
  TeamDetails,
} from '@knowguard/types';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import type { PrismaService } from '../src/common/prisma.service';
import { createTestApp, randomIp, uniqueEmail } from './test-app';

let app: INestApplication;
let prisma: PrismaService;
const orgIds: string[] = [];

const PASSWORD = 'correct horse battery staple';
const MISSING_ID = '00000000-0000-4000-8000-000000000000';
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const http = () => request(app.getHttpServer());

/** Authenticated request helper bound to one session token. */
function as(token: string) {
  const auth = { Authorization: `Bearer ${token}` };
  return {
    get: (path: string) => http().get(`/api/v1${path}`).set(auth),
    post: (path: string, body?: object) => http().post(`/api/v1${path}`).set(auth).send(body),
    put: (path: string, body?: object) => http().put(`/api/v1${path}`).set(auth).send(body),
    patch: (path: string, body?: object) => http().patch(`/api/v1${path}`).set(auth).send(body),
    delete: (path: string) => http().delete(`/api/v1${path}`).set(auth),
  };
}

async function registerOwner(organizationName: string) {
  const email = uniqueEmail('owner');
  const res = await http()
    .post('/api/v1/auth/register')
    .set('X-Forwarded-For', randomIp())
    .send({ name: 'Owner', email, password: PASSWORD, organizationName })
    .expect(201);
  const token = (res.body as SessionGrant).token;
  const me = (await as(token).get('/auth/me').expect(200)).body as MeResponse;
  orgIds.push(me.organization.id);
  return { token, email, userId: me.user.id, organizationId: me.organization.id };
}

async function invite(ownerToken: string, roleKey: string, name = 'Invitee') {
  const email = uniqueEmail(roleKey.toLowerCase());
  const res = await as(ownerToken).post('/users/invitations', { name, email, roleKey }).expect(201);
  return { email, ...(res.body as InviteMemberResponse) };
}

const acceptInvitation = (token: string, body: object = { password: PASSWORD }) =>
  http().post(`/api/v1/invitations/${token}/accept`).set('X-Forwarded-For', randomIp()).send(body);

/** Invites and activates a member, returning their session token. */
async function addMember(ownerToken: string, roleKey: string) {
  const invited = await invite(ownerToken, roleKey);
  const grant = (await acceptInvitation(invited.invitation.token).expect(200)).body as SessionGrant;
  return { token: grant.token, userId: invited.member.id, email: invited.email };
}

let owner: Awaited<ReturnType<typeof registerOwner>>;
let admin: Awaited<ReturnType<typeof addMember>>;
let employee: Awaited<ReturnType<typeof addMember>>;
let otherOwner: Awaited<ReturnType<typeof registerOwner>>;

beforeAll(async () => {
  ({ app, prisma } = await createTestApp());
  owner = await registerOwner('Org A');
  admin = await addMember(owner.token, 'ADMIN');
  employee = await addMember(owner.token, 'EMPLOYEE');
  otherOwner = await registerOwner('Org B');
});

afterAll(async () => {
  if (prisma && orgIds.length > 0) {
    const where = { organizationId: { in: orgIds } };
    const memberships = await prisma.userOrganization.findMany({ where, select: { userId: true } });
    await prisma.user.deleteMany({ where: { id: { in: memberships.map((m) => m.userId) } } });
    await prisma.team.deleteMany({ where });
    await prisma.department.deleteMany({ where });
    await prisma.role.deleteMany({ where });
    await purgeAuditLogs(prisma, { organizationId: { in: orgIds } });
    await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
  }
  await app?.close();
});

describe('RBAC: capability checks', () => {
  it.each([
    ['POST', '/users/invitations'],
    ['POST', '/users/00000000-0000-4000-8000-000000000000/suspend'],
    ['GET', '/roles'],
    ['POST', '/departments'],
    ['POST', '/teams'],
    ['PATCH', '/organization'],
  ])('EMPLOYEE is forbidden: %s %s', async (method, path) => {
    const client = as(employee.token);
    const res = await (method === 'GET'
      ? client.get(path)
      : method === 'PATCH'
        ? client.patch(path, { name: 'x' })
        : client.post(path, {}));
    expect(res.status).toBe(403);
    expect(res.body).toEqual({
      error: { code: 'FORBIDDEN', message: 'You do not have permission to perform this action.' },
    });
  });

  it.each(['/users', '/roles', '/departments', '/teams', '/organization'])(
    'anonymous requests to %s are 401',
    async (path) => {
      await http().get(`/api/v1${path}`).expect(401);
    },
  );

  it('EMPLOYEE can read the member directory and organization structure (user.read, organization.read)', async () => {
    await as(employee.token).get('/users').expect(200);
    await as(employee.token).get('/departments').expect(200);
    await as(employee.token).get('/teams').expect(200);
    await as(employee.token).get('/organization').expect(200);
  });

  it('ADMIN can manage users but not organization settings', async () => {
    await as(admin.token).get('/users').expect(200);
    await as(admin.token).patch('/organization', { name: 'Renamed by admin' }).expect(403);
  });
});

describe('invitations', () => {
  it('creates an INVITED member who cannot log in until they accept', async () => {
    const invited = await invite(owner.token, 'EMPLOYEE', 'Pending Person');
    expect(invited.member).toMatchObject({ status: 'INVITED', roles: ['EMPLOYEE'], name: 'Pending Person' });
    expect(invited.invitation.token).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const stored = await prisma.invitation.findFirstOrThrow({ where: { userId: invited.member.id } });
    expect(stored.tokenHash).toBe(sha256(invited.invitation.token));
    expect(stored.invitedById).toBe(owner.userId);

    const login = await http()
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', randomIp())
      .send({ email: invited.email, password: PASSWORD });
    expect(login.status).toBe(401);
    expect(login.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('previews and accepts an invitation, signing the member in with the invited role', async () => {
    const invited = await invite(owner.token, 'MANAGER', 'Mona Manager');
    const preview = await http()
      .get(`/api/v1/invitations/${invited.invitation.token}`)
      .set('X-Forwarded-For', randomIp())
      .expect(200);
    expect(preview.body).toMatchObject({
      organizationName: 'Org A',
      email: invited.email,
      name: 'Mona Manager',
    });

    const grant = (
      await acceptInvitation(invited.invitation.token, { password: PASSWORD, name: 'Mona M.' }).expect(200)
    ).body as SessionGrant;
    const me = (await as(grant.token).get('/auth/me').expect(200)).body as MeResponse;
    expect(me.organization.id).toBe(owner.organizationId);
    expect(me.roles).toEqual(['MANAGER']);
    expect(me.user.name).toBe('Mona M.');

    // One-time: the same link cannot be used again.
    const again = await acceptInvitation(invited.invitation.token).expect(404);
    expect(again.body.error.code).toBe('INVITATION_INVALID');
  });

  it('only one of two concurrent accepts succeeds', async () => {
    const invited = await invite(owner.token, 'EMPLOYEE');
    const results = await Promise.all([
      acceptInvitation(invited.invitation.token),
      acceptInvitation(invited.invitation.token),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 404]);
  });

  it('a re-issued link invalidates the previous one', async () => {
    const invited = await invite(owner.token, 'EMPLOYEE');
    const fresh = await as(owner.token).post(`/users/${invited.member.id}/invitations`).expect(201);
    await acceptInvitation(invited.invitation.token).expect(404);
    await acceptInvitation(fresh.body.token).expect(200);
  });

  it('refuses to re-issue links for members who already joined', async () => {
    const res = await as(owner.token).post(`/users/${employee.userId}/invitations`).expect(409);
    expect(res.body.error.code).toBe('NOT_INVITED');
  });

  it('rejects expired invitations', async () => {
    const invited = await invite(owner.token, 'EMPLOYEE');
    await prisma.invitation.updateMany({
      where: { tokenHash: sha256(invited.invitation.token) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await acceptInvitation(invited.invitation.token).expect(404);
  });

  it('enforces the password policy on acceptance', async () => {
    const invited = await invite(owner.token, 'EMPLOYEE');
    const res = await acceptInvitation(invited.invitation.token, { password: 'short' }).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('rejects inviting an email that already has an account', async () => {
    const res = await as(owner.token)
      .post('/users/invitations', { name: 'Dup', email: otherOwner.email, roleKey: 'EMPLOYEE' })
      .expect(409);
    expect(res.body.error.code).toBe('EMAIL_UNAVAILABLE');
  });

  it('rejects unknown roles and client-supplied tenant fields', async () => {
    await as(owner.token)
      .post('/users/invitations', { name: 'X', email: uniqueEmail(), roleKey: 'SUPERUSER' })
      .expect(404);
    const res = await as(owner.token)
      .post('/users/invitations', {
        name: 'X',
        email: uniqueEmail(),
        roleKey: 'EMPLOYEE',
        organizationId: otherOwner.organizationId,
      })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });
});

describe('privilege escalation is impossible', () => {
  it('ADMIN cannot invite an OWNER', async () => {
    const res = await as(admin.token)
      .post('/users/invitations', { name: 'X', email: uniqueEmail(), roleKey: 'OWNER' })
      .expect(403);
    expect(res.body.error.code).toBe('ROLE_EXCEEDS_YOUR_ACCESS');
  });

  it('ADMIN cannot promote anyone to OWNER', async () => {
    const res = await as(admin.token)
      .put(`/users/${employee.userId}/roles`, { roleKeys: ['OWNER'] })
      .expect(403);
    expect(res.body.error.code).toBe('ROLE_EXCEEDS_YOUR_ACCESS');
  });

  it('ADMIN cannot suspend or re-role the OWNER', async () => {
    expect((await as(admin.token).post(`/users/${owner.userId}/suspend`).expect(403)).body.error.code).toBe(
      'TARGET_HAS_MORE_ACCESS',
    );
    await as(admin.token)
      .put(`/users/${owner.userId}/roles`, { roleKeys: ['EMPLOYEE'] })
      .expect(403);
  });

  it('nobody can change their own roles or status', async () => {
    expect((await as(owner.token).post(`/users/${owner.userId}/suspend`).expect(403)).body.error.code).toBe(
      'SELF',
    );
    await as(admin.token)
      .put(`/users/${admin.userId}/roles`, { roleKeys: ['OWNER'] })
      .expect(403);
  });

  it('reports which members the caller may manage', async () => {
    const { members } = (await as(admin.token).get('/users').expect(200)).body as MemberListResponse;
    const find = (id: string) => members.find((m) => m.id === id)!;
    expect(find(owner.userId).manageable).toBe(false);
    expect(find(admin.userId).manageable).toBe(false);
    expect(find(employee.userId).manageable).toBe(true);
  });

  it('marks only roles within the caller’s own access as assignable', async () => {
    const { roles } = (await as(admin.token).get('/roles').expect(200)).body as RoleListResponse;
    const assignable = Object.fromEntries(roles.map((role) => [role.key, role.assignable]));
    expect(assignable).toEqual({ OWNER: false, ADMIN: true, MANAGER: true, EMPLOYEE: true });
  });
});

describe('role changes and suspension', () => {
  it('a role change takes effect on the member’s next request', async () => {
    const member = await addMember(owner.token, 'EMPLOYEE');
    await as(member.token).get('/roles').expect(403);
    const updated = (
      await as(owner.token)
        .put(`/users/${member.userId}/roles`, { roleKeys: ['ADMIN'] })
        .expect(200)
    ).body as MemberSummary;
    expect(updated.roles).toEqual(['ADMIN']);
    await as(member.token).get('/roles').expect(200);
  });

  it('suspension signs the member out immediately; reactivation lets them back in', async () => {
    const member = await addMember(owner.token, 'EMPLOYEE');
    await as(member.token).get('/auth/me').expect(200);

    const suspended = (await as(owner.token).post(`/users/${member.userId}/suspend`).expect(200))
      .body as MemberSummary;
    expect(suspended.status).toBe('SUSPENDED');
    await as(member.token).get('/auth/me').expect(401);
    await http()
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', randomIp())
      .send({ email: member.email, password: PASSWORD })
      .expect(401);

    const reactivated = (await as(owner.token).post(`/users/${member.userId}/reactivate`).expect(200))
      .body as MemberSummary;
    expect(reactivated.status).toBe('ACTIVE');
    await http()
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', randomIp())
      .send({ email: member.email, password: PASSWORD })
      .expect(200);
  });

  it('suspending an invited member revokes their invitation link', async () => {
    const invited = await invite(owner.token, 'EMPLOYEE');
    await as(owner.token).post(`/users/${invited.member.id}/suspend`).expect(200);
    await acceptInvitation(invited.invitation.token).expect(404);
    const back = (await as(owner.token).post(`/users/${invited.member.id}/reactivate`).expect(200))
      .body as MemberSummary;
    expect(back.status).toBe('INVITED');
  });

  it('an OWNER can demote another OWNER, and ownership always remains', async () => {
    const secondOwner = await addMember(owner.token, 'OWNER');
    await as(secondOwner.token)
      .put(`/users/${owner.userId}/roles`, { roleKeys: ['ADMIN'] })
      .expect(200);
    // The first owner (now ADMIN) cannot take ownership back.
    await as(owner.token)
      .put(`/users/${secondOwner.userId}/roles`, { roleKeys: ['EMPLOYEE'] })
      .expect(403);
    await as(secondOwner.token)
      .put(`/users/${owner.userId}/roles`, { roleKeys: ['OWNER'] })
      .expect(200);
  });
});

describe('tenant isolation', () => {
  it('lists only members of the caller’s organization', async () => {
    const { members } = (await as(otherOwner.token).get('/users').expect(200)).body as MemberListResponse;
    expect(members.map((m) => m.id)).toEqual([otherOwner.userId]);
  });

  it.each([
    ['GET', (id: string) => `/users/${id}`],
    ['POST', (id: string) => `/users/${id}/suspend`],
    ['POST', (id: string) => `/users/${id}/reactivate`],
    ['POST', (id: string) => `/users/${id}/invitations`],
    ['PUT', (id: string) => `/users/${id}/roles`],
  ])('%s on another organization’s member is 404, identical to a missing one', async (method, path) => {
    const client = as(otherOwner.token);
    const call = (id: string) =>
      method === 'GET'
        ? client.get(path(id))
        : method === 'PUT'
          ? client.put(path(id), { roleKeys: ['EMPLOYEE'] })
          : client.post(path(id));
    const foreign = await call(employee.userId);
    const missing = await call(MISSING_ID);
    expect(foreign.status).toBe(404);
    expect(foreign.body).toEqual(missing.body);
  });

  it('cannot touch another organization’s departments or add its members', async () => {
    const dept = (await as(owner.token).post('/departments', { name: 'Isolated Dept' }).expect(201))
      .body as DepartmentDetails;
    await as(otherOwner.token).patch(`/departments/${dept.id}`, { name: 'Hijacked' }).expect(404);
    await as(otherOwner.token).delete(`/departments/${dept.id}`).expect(404);
    await as(otherOwner.token).put(`/departments/${dept.id}/members/${otherOwner.userId}`).expect(404);

    const ownDept = (await as(otherOwner.token).post('/departments', { name: 'B Dept' }).expect(201))
      .body as DepartmentDetails;
    const res = await as(otherOwner.token)
      .put(`/departments/${ownDept.id}/members/${employee.userId}`)
      .expect(404);
    expect(res.body.error.message).toBe('The requested member was not found.');
    // And a team cannot be created under another organization's department.
    await as(otherOwner.token).post('/teams', { name: 'Rogue', departmentId: dept.id }).expect(404);
  });

  it('treats malformed IDs exactly like unknown ones', async () => {
    await as(owner.token).get('/users/not-a-uuid').expect(404);
    await as(owner.token).patch('/departments/../../x', { name: 'x' }).expect(404);
  });
});

describe('departments and teams', () => {
  it('supports the full lifecycle with membership', async () => {
    const client = as(owner.token);
    const dept = (
      await client.post('/departments', { name: 'Engineering', description: 'Builders' }).expect(201)
    ).body as DepartmentDetails;
    await client.post('/departments', { name: 'Engineering' }).expect(409);

    const team = (await client.post('/teams', { name: 'Platform', departmentId: dept.id }).expect(201))
      .body as TeamDetails;
    expect(team.department).toEqual({ id: dept.id, name: 'Engineering' });
    await client.post('/teams', { name: 'Platform', departmentId: dept.id }).expect(409);

    await client.put(`/departments/${dept.id}/members/${employee.userId}`).expect(204);
    await client.put(`/departments/${dept.id}/members/${employee.userId}`).expect(204); // idempotent
    await client.put(`/teams/${team.id}/members/${employee.userId}`).expect(204);

    const { members } = (await client.get('/users').expect(200)).body as MemberListResponse;
    const emp = members.find((m) => m.id === employee.userId)!;
    expect(emp.departments.map((d) => d.name)).toContain('Engineering');
    expect(emp.teams.map((t) => t.name)).toContain('Platform');

    const teams = (await as(employee.token).get('/teams').expect(200)).body.teams as TeamDetails[];
    expect(teams.find((t) => t.id === team.id)!.members.map((m) => m.id)).toEqual([employee.userId]);

    const blocked = await client.delete(`/departments/${dept.id}`).expect(409);
    expect(blocked.body.error.code).toBe('DEPARTMENT_NOT_EMPTY');

    await client.delete(`/teams/${team.id}/members/${employee.userId}`).expect(204);
    await client.delete(`/teams/${team.id}`).expect(204);
    await client.delete(`/departments/${dept.id}`).expect(204);
    await client.get('/departments').expect(200);
  });

  it('ADMIN may manage structure (department.manage / team.manage)', async () => {
    const dept = (await as(admin.token).post('/departments', { name: 'Admin Made' }).expect(201))
      .body as DepartmentDetails;
    await as(admin.token).patch(`/departments/${dept.id}`, { name: 'Admin Renamed' }).expect(200);
    await as(admin.token).delete(`/departments/${dept.id}`).expect(204);
  });
});

describe('organization settings', () => {
  it('OWNER can rename; the slug is immutable and tenant fields are rejected', async () => {
    const before = (await as(owner.token).get('/organization').expect(200)).body;
    const after = (await as(owner.token).patch('/organization', { name: 'Org A Renamed' }).expect(200)).body;
    expect(after).toMatchObject({ name: 'Org A Renamed', slug: before.slug });
    await as(owner.token).patch('/organization', { name: 'x', slug: 'hijack' }).expect(400);
  });
});

describe('custom roles (Phase 4)', () => {
  const createRole = (token: string, body: object) => as(token).post('/roles', body);

  it('exposes the permission catalog to role readers only', async () => {
    const res = await as(owner.token).get('/permissions').expect(200);
    expect(res.body.permissions).toContainEqual({
      key: 'document.read',
      description: expect.any(String),
      group: 'document',
    });
    await as(employee.token).get('/permissions').expect(403);
  });

  it('creates a custom role, assigns it, and the member gets exactly its permissions', async () => {
    const role = (
      await createRole(owner.token, {
        name: 'Support Lead',
        description: 'Handles escalations',
        permissions: ['organization.read', 'user.read', 'role.read', 'document.read'],
      }).expect(201)
    ).body as RoleListResponse['roles'][number];
    expect(role).toMatchObject({ key: 'SUPPORT_LEAD', isSystem: false, assignable: true, editable: true });

    const member = await addMember(owner.token, 'EMPLOYEE');
    await as(member.token).get('/roles').expect(403);
    await as(owner.token)
      .put(`/users/${member.userId}/roles`, { roleKeys: ['SUPPORT_LEAD'] })
      .expect(200);
    const me = (await as(member.token).get('/auth/me').expect(200)).body as MeResponse;
    expect(me.roles).toEqual(['SUPPORT_LEAD']);
    expect(me.permissions).toEqual(['document.read', 'organization.read', 'role.read', 'user.read']);
    await as(member.token).get('/roles').expect(200);

    // Deleting a role that is still assigned is refused; after reassignment it succeeds.
    expect((await as(owner.token).delete(`/roles/${role.id}`).expect(409)).body.error.code).toBe(
      'ROLE_IN_USE',
    );
    await as(owner.token)
      .put(`/users/${member.userId}/roles`, { roleKeys: ['EMPLOYEE'] })
      .expect(200);
    await as(owner.token).delete(`/roles/${role.id}`).expect(204);
  });

  it('editing a custom role changes its holders’ access on their next request', async () => {
    const role = (
      await createRole(owner.token, { name: 'Readers', permissions: ['organization.read'] }).expect(201)
    ).body;
    const member = await addMember(owner.token, 'EMPLOYEE');
    await as(owner.token)
      .put(`/users/${member.userId}/roles`, { roleKeys: [role.key] })
      .expect(200);
    await as(member.token).get('/users').expect(403);
    await as(owner.token)
      .patch(`/roles/${role.id}`, { permissions: ['organization.read', 'user.read'] })
      .expect(200);
    await as(member.token).get('/users').expect(200);
  });

  it('ADMIN cannot create a role with permissions ADMIN lacks', async () => {
    const res = await createRole(admin.token, {
      name: 'Shadow Owner',
      permissions: ['organization.read', 'organization.update'],
    }).expect(403);
    expect(res.body.error.code).toBe('ROLE_EXCEEDS_YOUR_ACCESS');
  });

  it('ADMIN cannot edit or delete a custom role that has more access than ADMIN', async () => {
    const powerful = (
      await createRole(owner.token, { name: 'Co Owner', permissions: ['organization.update'] }).expect(201)
    ).body;
    const edit = await as(admin.token).patch(`/roles/${powerful.id}`, { name: 'Downgraded' }).expect(403);
    expect(edit.body.error.code).toBe('TARGET_HAS_MORE_ACCESS');
    await as(admin.token).delete(`/roles/${powerful.id}`).expect(403);
    const { roles } = (await as(admin.token).get('/roles').expect(200)).body as RoleListResponse;
    expect(roles.find((r) => r.id === powerful.id)).toMatchObject({ assignable: false, editable: false });
  });

  it('ADMIN cannot sneak permissions into a role it may edit', async () => {
    const role = (await createRole(admin.token, { name: 'Helpers', permissions: ['user.read'] }).expect(201))
      .body;
    const res = await as(admin.token)
      .patch(`/roles/${role.id}`, { permissions: ['user.read', 'organization.update'] })
      .expect(403);
    expect(res.body.error.code).toBe('ROLE_EXCEEDS_YOUR_ACCESS');
  });

  it('nobody can edit a role they hold', async () => {
    const role = (
      await createRole(owner.token, {
        name: 'Ops',
        permissions: ['organization.read', 'role.read', 'role.update'],
      }).expect(201)
    ).body;
    const member = await addMember(owner.token, 'EMPLOYEE');
    await as(owner.token)
      .put(`/users/${member.userId}/roles`, { roleKeys: [role.key] })
      .expect(200);
    const res = await as(member.token)
      .patch(`/roles/${role.id}`, { permissions: ['organization.read'] })
      .expect(403);
    expect(res.body.error.code).toBe('SELF');
  });

  it('built-in roles are immutable', async () => {
    const { roles } = (await as(owner.token).get('/roles').expect(200)).body as RoleListResponse;
    const employeeRole = roles.find((r) => r.key === 'EMPLOYEE')!;
    expect(employeeRole.editable).toBe(false);
    const res = await as(owner.token).patch(`/roles/${employeeRole.id}`, { name: 'Staff' }).expect(409);
    expect(res.body.error.code).toBe('SYSTEM_ROLE_IMMUTABLE');
    await as(owner.token).delete(`/roles/${employeeRole.id}`).expect(409);
  });

  it('rejects names that collide with existing roles and unknown permissions', async () => {
    expect(
      (await createRole(owner.token, { name: 'Owner', permissions: ['user.read'] }).expect(409)).body.error
        .code,
    ).toBe('NAME_TAKEN');
    await createRole(owner.token, { name: 'Weird', permissions: ['document.fly'] }).expect(400);
  });

  it('EMPLOYEE cannot create roles', async () => {
    await createRole(employee.token, { name: 'Mine', permissions: ['user.read'] }).expect(403);
  });

  it('roles of another organization are invisible', async () => {
    const role = (
      await createRole(owner.token, { name: 'Private To A', permissions: ['user.read'] }).expect(201)
    ).body;
    await as(otherOwner.token).patch(`/roles/${role.id}`, { name: 'Hijacked' }).expect(404);
    await as(otherOwner.token).delete(`/roles/${role.id}`).expect(404);
    const { roles } = (await as(otherOwner.token).get('/roles').expect(200)).body as RoleListResponse;
    expect(roles.map((r) => r.id)).not.toContain(role.id);
    // And cannot be assigned to members of another organization.
    await as(otherOwner.token)
      .put(`/users/${otherOwner.userId}/roles`, { roleKeys: ['PRIVATE_TO_A'] })
      .expect(404);
  });
});

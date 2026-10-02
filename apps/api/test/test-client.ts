import { purgeAuditLogs } from '@knowguard/database';
import type { InviteMemberResponse, MeResponse, SessionGrant } from '@knowguard/types';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import type { PrismaService } from '../src/common/prisma.service';
import { randomIp, uniqueEmail } from './test-app';

export const PASSWORD = 'correct horse battery staple';

export interface TestMember {
  token: string;
  userId: string;
  email: string;
}

export interface TestOwner extends TestMember {
  organizationId: string;
}

/** Thin helper over the real HTTP API for e2e tests; tracks created organizations for cleanup. */
export class TestClient {
  readonly organizationIds: string[] = [];

  constructor(
    private readonly app: INestApplication,
    private readonly prisma: PrismaService,
  ) {}

  http() {
    return request(this.app.getHttpServer());
  }

  as(token: string) {
    const auth = { Authorization: `Bearer ${token}` };
    const http = () => this.http();
    return {
      get: (path: string) => http().get(`/api/v1${path}`).set(auth),
      post: (path: string, body?: object) => http().post(`/api/v1${path}`).set(auth).send(body),
      put: (path: string, body?: object) => http().put(`/api/v1${path}`).set(auth).send(body),
      patch: (path: string, body?: object) => http().patch(`/api/v1${path}`).set(auth).send(body),
      delete: (path: string) => http().delete(`/api/v1${path}`).set(auth),
      /** Multipart request (uploads); attach files/fields on the returned supertest request. */
      multipart: (path: string) => http().post(`/api/v1${path}`).set(auth),
    };
  }

  async registerOwner(organizationName: string): Promise<TestOwner> {
    const email = uniqueEmail('owner');
    const res = await this.http()
      .post('/api/v1/auth/register')
      .set('X-Forwarded-For', randomIp())
      .send({ name: 'Owner', email, password: PASSWORD, organizationName })
      .expect(201);
    const token = (res.body as SessionGrant).token;
    const me = (await this.as(token).get('/auth/me').expect(200)).body as MeResponse;
    this.organizationIds.push(me.organization.id);
    return { token, email, userId: me.user.id, organizationId: me.organization.id };
  }

  async addMember(ownerToken: string, roleKey: string, name = 'Member'): Promise<TestMember> {
    const email = uniqueEmail(roleKey.toLowerCase());
    const invited = (
      await this.as(ownerToken).post('/users/invitations', { name, email, roleKey }).expect(201)
    ).body as InviteMemberResponse;
    const grant = (
      await this.http()
        .post(`/api/v1/invitations/${invited.invitation.token}/accept`)
        .set('X-Forwarded-For', randomIp())
        .send({ password: PASSWORD })
        .expect(200)
    ).body as SessionGrant;
    return { token: grant.token, userId: invited.member.id, email };
  }

  /** Deletes everything created in the tracked organizations (conversations and documents first: FK order). */
  async cleanup(): Promise<void> {
    if (this.organizationIds.length === 0) return;
    const where = { organizationId: { in: this.organizationIds } };
    await this.prisma.conversation.deleteMany({ where });
    await this.prisma.document.deleteMany({ where });
    const memberships = await this.prisma.userOrganization.findMany({ where, select: { userId: true } });
    await this.prisma.user.deleteMany({ where: { id: { in: memberships.map((m) => m.userId) } } });
    await this.prisma.team.deleteMany({ where });
    await this.prisma.department.deleteMany({ where });
    await this.prisma.role.deleteMany({ where });
    // Audit records are append-only; deleting them needs the explicit purge path.
    await purgeAuditLogs(this.prisma, where);
    await this.prisma.organization.deleteMany({ where: { id: { in: this.organizationIds } } });
  }
}

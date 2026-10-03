import { Injectable } from '@nestjs/common';
import { type Prisma, readableDocumentsWhere } from '@knowguard/database';
import type { AuditLogEntry, AuditLogPage, AuditResourceTypeValue } from '@knowguard/types';
import type { AuditQuery } from '@knowguard/validation';

import { type AuthContext, toAuthorizationContext } from '../auth/auth-context';
import { PrismaService } from '../common/prisma.service';

type AuditRow = Prisma.AuditLogGetPayload<object>;

/**
 * Reading the audit log (requires audit.read). Always scoped to the caller's organization.
 *
 * Labels are resolved at read time with the viewer's own access: a document's title is shown
 * only if the viewer may read that document, so holding audit.read never reveals the names of
 * private documents. Conversation titles (users' own questions) are never shown.
 */
@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async list(auth: AuthContext, query: AuditQuery): Promise<AuditLogPage> {
    const where: Prisma.AuditLogWhereInput = {
      organizationId: auth.organizationId,
      ...(query.action ? { action: query.action } : {}),
      ...(query.result ? { result: query.result } : {}),
      ...(query.resourceType ? { resourceType: query.resourceType } : {}),
      ...(query.resourceId ? { resourceId: query.resourceId } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };
    const rows = await this.prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const page = rows.slice(0, query.limit);
    const [actors, labels] = await Promise.all([this.actors(page), this.labels(auth, page)]);
    return {
      entries: page.map((row) => this.toEntry(row, actors, labels)),
      nextCursor: rows.length > query.limit ? (page.at(-1)?.id ?? null) : null,
    };
  }

  private toEntry(
    row: AuditRow,
    actors: Map<string, { name: string; email: string }>,
    labels: Map<string, string>,
  ): AuditLogEntry {
    const actor = row.userId ? actors.get(row.userId) : undefined;
    return {
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      action: row.action,
      result: row.result,
      actor: row.userId ? { id: row.userId, name: actor?.name ?? null, email: actor?.email ?? null } : null,
      resourceType: row.resourceType,
      resourceId: row.resourceId,
      resourceLabel: row.resourceId ? (labels.get(`${row.resourceType}:${row.resourceId}`) ?? null) : null,
      metadata:
        row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
          ? (row.metadata as Record<string, unknown>)
          : {},
      ip: row.ip,
    };
  }

  private async actors(rows: AuditRow[]): Promise<Map<string, { name: string; email: string }>> {
    const ids = [...new Set(rows.flatMap((r) => (r.userId ? [r.userId] : [])))];
    if (ids.length === 0) return new Map();
    const users = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, email: true },
    });
    return new Map(users.map((u) => [u.id, { name: u.name, email: u.email }]));
  }

  /** "TYPE:id" → name, for resources of this organization the viewer may see named. */
  private async labels(auth: AuthContext, rows: AuditRow[]): Promise<Map<string, string>> {
    const ids = (type: AuditResourceTypeValue) => [
      ...new Set(
        rows.filter((r) => r.resourceType === type && r.resourceId).map((r) => r.resourceId as string),
      ),
    ];
    const organizationId = auth.organizationId;
    const [documents, users, roles, teams, departments] = await Promise.all([
      ids('DOCUMENT').length
        ? this.prisma.document.findMany({
            where: {
              AND: [readableDocumentsWhere(toAuthorizationContext(auth)), { id: { in: ids('DOCUMENT') } }],
            },
            select: { id: true, title: true },
          })
        : [],
      ids('USER').length
        ? this.prisma.userOrganization.findMany({
            where: { organizationId, userId: { in: ids('USER') } },
            select: { user: { select: { id: true, name: true } } },
          })
        : [],
      ids('ROLE').length
        ? this.prisma.role.findMany({
            where: { organizationId, id: { in: ids('ROLE') } },
            select: { id: true, name: true },
          })
        : [],
      ids('TEAM').length
        ? this.prisma.team.findMany({
            where: { organizationId, id: { in: ids('TEAM') } },
            select: { id: true, name: true },
          })
        : [],
      ids('DEPARTMENT').length
        ? this.prisma.department.findMany({
            where: { organizationId, id: { in: ids('DEPARTMENT') } },
            select: { id: true, name: true },
          })
        : [],
    ]);
    return new Map<string, string>([
      ...documents.map((d): [string, string] => [`DOCUMENT:${d.id}`, d.title]),
      ...users.map((m): [string, string] => [`USER:${m.user.id}`, m.user.name]),
      ...roles.map((r): [string, string] => [`ROLE:${r.id}`, r.name]),
      ...teams.map((t): [string, string] => [`TEAM:${t.id}`, t.name]),
      ...departments.map((d): [string, string] => [`DEPARTMENT:${d.id}`, d.name]),
    ]);
  }
}

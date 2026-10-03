import { Injectable } from '@nestjs/common';
import { readableDocumentsWhere } from '@knowguard/database';
import type { AnalyticsDay, AnalyticsOverview, DocumentStatusValue } from '@knowguard/types';

import { type AuthContext, toAuthorizationContext } from '../auth/auth-context';
import { PrismaService } from '../common/prisma.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const TOP_DOCUMENTS = 10;
const TOP_USERS = 5;

const ACTIVITY_FIELDS = {
  SEARCH: 'searches',
  AI_QUERY: 'aiQueries',
  DOCUMENT_VIEW: 'views',
  DOCUMENT_DOWNLOAD: 'downloads',
  DOCUMENT_CREATE: 'uploads',
  ACCESS_DENIED: 'denied',
} as const satisfies Record<string, keyof Omit<AnalyticsDay, 'date'>>;

const utcDate = (date: Date): string => date.toISOString().slice(0, 10);

/**
 * Organization analytics for administrators (requires audit.read). Activity comes from the audit
 * log, current state from the live tables. Counts only: no content, queries or questions. Like the
 * audit log, document titles appear only for documents the viewer can read.
 */
@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(auth: AuthContext, days: number): Promise<AnalyticsOverview> {
    const organizationId = auth.organizationId;
    // Whole UTC days: today plus the previous days-1 days.
    const today = new Date(`${utcDate(new Date())}T00:00:00.000Z`);
    const since = new Date(today.getTime() - (days - 1) * DAY_MS);

    const [members, documentStatus, documentTotals, chunks, activity, ai, viewed, cited, users] =
      await Promise.all([
        this.prisma.userOrganization.groupBy({ by: ['status'], where: { organizationId }, _count: true }),
        this.prisma.document.groupBy({ by: ['status'], where: { organizationId }, _count: true }),
        this.prisma.document.aggregate({ where: { organizationId }, _sum: { size: true }, _count: true }),
        this.prisma.documentChunk.count({ where: { organizationId } }),
        this.prisma.$queryRaw<Array<{ day: Date; action: string; count: bigint }>>`
          SELECT date_trunc('day', created_at AT TIME ZONE 'UTC') AS day, action::text AS action, count(*) AS count
          FROM audit_logs
          WHERE organization_id = ${organizationId}::uuid AND created_at >= ${since}
            AND action::text = ANY(${Object.keys(ACTIVITY_FIELDS)})
          GROUP BY 1, 2`,
        this.prisma.$queryRaw<
          Array<{ outcome: string | null; count: bigint; prompt: bigint | null; output: bigint | null }>
        >`
          SELECT metadata->>'outcome' AS outcome, count(*) AS count,
                 sum((metadata->>'promptTokens')::bigint) AS prompt,
                 sum((metadata->>'outputTokens')::bigint) AS output
          FROM audit_logs
          WHERE organization_id = ${organizationId}::uuid AND created_at >= ${since} AND action = 'AI_QUERY'
          GROUP BY 1`,
        this.prisma.$queryRaw<Array<{ id: string; count: bigint }>>`
          SELECT resource_id::text AS id, count(*) AS count
          FROM audit_logs
          WHERE organization_id = ${organizationId}::uuid AND created_at >= ${since}
            AND action = 'DOCUMENT_VIEW' AND resource_id IS NOT NULL
          GROUP BY 1 ORDER BY 2 DESC LIMIT ${TOP_DOCUMENTS * 2}`,
        this.prisma.$queryRaw<Array<{ id: string; count: bigint }>>`
          SELECT cited.id AS id, count(*) AS count
          FROM audit_logs, jsonb_array_elements_text(
            CASE WHEN jsonb_typeof(metadata->'citedDocumentIds') = 'array' THEN metadata->'citedDocumentIds' ELSE '[]'::jsonb END
          ) AS cited(id)
          WHERE organization_id = ${organizationId}::uuid AND created_at >= ${since} AND action = 'AI_QUERY'
          GROUP BY 1 ORDER BY 2 DESC LIMIT ${TOP_DOCUMENTS * 2}`,
        this.prisma.$queryRaw<Array<{ id: string; count: bigint }>>`
          SELECT user_id::text AS id, count(*) AS count
          FROM audit_logs
          WHERE organization_id = ${organizationId}::uuid AND created_at >= ${since} AND user_id IS NOT NULL
          GROUP BY 1 ORDER BY 2 DESC LIMIT ${TOP_USERS}`,
      ]);

    return {
      days,
      members: {
        active: members.find((m) => m.status === 'ACTIVE')?._count ?? 0,
        suspended: members.find((m) => m.status === 'SUSPENDED')?._count ?? 0,
        invited: members.find((m) => m.status === 'INVITED')?._count ?? 0,
      },
      documents: {
        total: documentTotals._count,
        byStatus: Object.fromEntries(documentStatus.map((s) => [s.status, s._count])) as Partial<
          Record<DocumentStatusValue, number>
        >,
        storageBytes: documentTotals._sum.size ?? 0,
        chunks,
      },
      activity: this.dailyActivity(since, days, activity),
      ai: this.aiSummary(ai),
      topDocuments: await this.topDocuments(auth, viewed, cited),
      topUsers: await this.topUsers(users),
    };
  }

  private dailyActivity(
    since: Date,
    days: number,
    rows: Array<{ day: Date; action: string; count: bigint }>,
  ): AnalyticsDay[] {
    const byDate = new Map<string, AnalyticsDay>();
    for (let i = 0; i < days; i += 1) {
      const date = utcDate(new Date(since.getTime() + i * DAY_MS));
      byDate.set(date, { date, searches: 0, aiQueries: 0, views: 0, downloads: 0, uploads: 0, denied: 0 });
    }
    for (const row of rows) {
      const day = byDate.get(utcDate(new Date(row.day)));
      const field = ACTIVITY_FIELDS[row.action as keyof typeof ACTIVITY_FIELDS];
      if (day && field) day[field] += Number(row.count);
    }
    return [...byDate.values()];
  }

  private aiSummary(
    rows: Array<{ outcome: string | null; count: bigint; prompt: bigint | null; output: bigint | null }>,
  ): AnalyticsOverview['ai'] {
    const count = (outcome: string) => Number(rows.find((r) => r.outcome === outcome)?.count ?? 0);
    return {
      questions: rows.reduce((n, r) => n + Number(r.count), 0),
      answered: count('ANSWERED'),
      notFound: count('NO_ANSWER'),
      failed: count('FAILED'),
      promptTokens: rows.reduce((n, r) => n + Number(r.prompt ?? 0), 0),
      outputTokens: rows.reduce((n, r) => n + Number(r.output ?? 0), 0),
    };
  }

  private async topDocuments(
    auth: AuthContext,
    viewed: Array<{ id: string; count: bigint }>,
    cited: Array<{ id: string; count: bigint }>,
  ): Promise<AnalyticsOverview['topDocuments']> {
    const stats = new Map<string, { views: number; citations: number }>();
    for (const row of viewed) stats.set(row.id, { views: Number(row.count), citations: 0 });
    for (const row of cited) {
      const entry = stats.get(row.id) ?? { views: 0, citations: 0 };
      entry.citations = Number(row.count);
      stats.set(row.id, entry);
    }
    const top = [...stats.entries()]
      .sort((a, b) => b[1].views + b[1].citations - (a[1].views + a[1].citations))
      .slice(0, TOP_DOCUMENTS);
    const readable = await this.prisma.document.findMany({
      where: {
        AND: [readableDocumentsWhere(toAuthorizationContext(auth)), { id: { in: top.map(([id]) => id) } }],
      },
      select: { id: true, title: true },
    });
    const titles = new Map(readable.map((d) => [d.id, d.title]));
    return top.map(([documentId, s]) => ({ documentId, title: titles.get(documentId) ?? null, ...s }));
  }

  private async topUsers(rows: Array<{ id: string; count: bigint }>): Promise<AnalyticsOverview['topUsers']> {
    const users = await this.prisma.user.findMany({
      where: { id: { in: rows.map((r) => r.id) } },
      select: { id: true, name: true, email: true },
    });
    const byId = new Map(users.map((u) => [u.id, u]));
    return rows.map((row) => ({
      user: { id: row.id, name: byId.get(row.id)?.name ?? null, email: byId.get(row.id)?.email ?? null },
      events: Number(row.count),
    }));
  }
}

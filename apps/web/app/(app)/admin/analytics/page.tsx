import type { AnalyticsDay, AnalyticsOverview } from '@knowguard/types';
import type { Metadata } from 'next';
import Link from 'next/link';

import { ActivityChart } from '@/components/analytics/activity-chart';
import { formatBytes } from '@/components/documents/document-labels';
import { AccessDenied, PageHeader } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiRequest } from '@/lib/api';
import { can } from '@/lib/permissions';
import { getSessionToken, requireUser } from '@/lib/session';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Analytics' };

const PERIODS = [7, 30, 90] as const;

const METRICS: ReadonlyArray<{ metric: keyof Omit<AnalyticsDay, 'date'>; title: string }> = [
  { metric: 'searches', title: 'Searches' },
  { metric: 'aiQueries', title: 'AI questions' },
  { metric: 'views', title: 'Document views' },
  { metric: 'downloads', title: 'Downloads' },
  { metric: 'uploads', title: 'Uploads' },
  { metric: 'denied', title: 'Access denied' },
];

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <Card className="gap-1 py-4">
      <CardContent className="flex flex-col gap-0.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="font-display text-[1.75rem] leading-none font-bold tracking-tight tabular-nums">
          {value}
        </span>
        {detail ? <span className="text-xs text-muted-foreground">{detail}</span> : null}
      </CardContent>
    </Card>
  );
}

const pct = (part: number, whole: number) => (whole === 0 ? '—' : `${Math.round((part / whole) * 100)}%`);

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string | string[] }>;
}) {
  const me = await requireUser();
  if (!can(me, 'audit.read')) return <AccessDenied what="analytics" />;
  const token = await getSessionToken();
  const requested = Number((await searchParams).days);
  const days = (PERIODS as readonly number[]).includes(requested) ? requested : 30;
  const data = await apiRequest<AnalyticsOverview>(`/analytics/overview?days=${days}`, { token });
  const ready = data.documents.byStatus.READY ?? 0;
  const failed = data.documents.byStatus.FAILED ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Analytics"
        description="Usage of your organization's knowledge base, from the audit log. Counts only: no queries, questions or content."
        actions={
          <nav aria-label="Period" className="flex gap-1 rounded-full border bg-card p-1 text-sm shadow-xs">
            {PERIODS.map((period) => (
              <Link
                key={period}
                href={`/admin/analytics?days=${period}`}
                aria-current={period === days ? 'page' : undefined}
                className={cn(
                  'rounded-full px-3.5 py-1.5 transition-colors',
                  period === days
                    ? 'bg-ink font-medium text-white'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {period} days
              </Link>
            ))}
          </nav>
        }
      />

      <section
        aria-label="Summary"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        data-testid="analytics-summary"
      >
        <Stat
          label="Active members"
          value={data.members.active.toLocaleString()}
          detail={`${data.members.invited} invited · ${data.members.suspended} suspended`}
        />
        <Stat
          label="Documents"
          value={data.documents.total.toLocaleString()}
          detail={`${ready} ready · ${failed} failed · ${formatBytes(data.documents.storageBytes)}`}
        />
        <Stat
          label={`AI questions (${days} days)`}
          value={data.ai.questions.toLocaleString()}
          detail={`${pct(data.ai.answered, data.ai.questions)} answered · ${pct(data.ai.notFound, data.ai.questions)} not found · ${data.ai.failed} failed`}
        />
        <Stat
          label={`AI tokens (${days} days)`}
          value={(data.ai.promptTokens + data.ai.outputTokens).toLocaleString()}
          detail={`${data.ai.promptTokens.toLocaleString()} in · ${data.ai.outputTokens.toLocaleString()} out`}
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Activity per day</CardTitle>
          <CardDescription>
            UTC days. Each chart has its own scale; hover or focus a bar for its value.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="grid gap-x-8 gap-y-6 md:grid-cols-2 xl:grid-cols-3">
            {METRICS.map(({ metric, title }) => (
              <ActivityChart key={metric} title={title} metric={metric} days={data.activity} />
            ))}
          </div>
          <details>
            <summary className="cursor-pointer text-sm text-muted-foreground">Show as a table</summary>
            <div className="mt-3 max-h-80 overflow-auto">
              <table className="w-full text-sm tabular-nums" data-testid="activity-table">
                <thead className="sticky top-0 border-b bg-card text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-2 py-2 text-left font-medium">
                      Date
                    </th>
                    {METRICS.map(({ metric, title }) => (
                      <th key={metric} scope="col" className="px-2 py-2 text-right font-medium">
                        {title}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {[...data.activity].reverse().map((day) => (
                    <tr key={day.date}>
                      <th scope="row" className="px-2 py-1.5 text-left font-normal">
                        {day.date}
                      </th>
                      {METRICS.map(({ metric }) => (
                        <td key={metric} className="px-2 py-1.5 text-right">
                          {day[metric]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Most used documents</CardTitle>
            <CardDescription>
              Views and AI citations. Documents you cannot read are listed without their title.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.topDocuments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No document activity in this period.</p>
            ) : (
              <table className="w-full text-sm" data-testid="top-documents">
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="py-1.5 text-left font-medium">
                      Document
                    </th>
                    <th scope="col" className="py-1.5 text-right font-medium">
                      Views
                    </th>
                    <th scope="col" className="py-1.5 text-right font-medium">
                      Citations
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y tabular-nums">
                  {data.topDocuments.map((doc) => (
                    <tr key={doc.documentId}>
                      <td className="py-1.5">
                        {doc.title ? (
                          <Link href={`/documents/${doc.documentId}`} className="hover:underline">
                            {doc.title}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">
                            Not visible to you ({doc.documentId.slice(0, 8)}…)
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 text-right">{doc.views}</td>
                      <td className="py-1.5 text-right">{doc.citations}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Most active members</CardTitle>
            <CardDescription>Audited events in this period.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.topUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity in this period.</p>
            ) : (
              <table className="w-full text-sm" data-testid="top-users">
                <tbody className="divide-y tabular-nums">
                  {data.topUsers.map(({ user, events }) => (
                    <tr key={user.id}>
                      <td className="py-1.5">
                        <Link href={`/admin/audit?userId=${user.id}`} className="hover:underline">
                          {user.name ?? 'Deleted user'}
                        </Link>
                        {user.email ? (
                          <span className="block text-xs text-muted-foreground">{user.email}</span>
                        ) : null}
                      </td>
                      <td className="py-1.5 text-right">{events.toLocaleString()} events</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

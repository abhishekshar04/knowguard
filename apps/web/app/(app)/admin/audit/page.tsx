import { AUDIT_ACTIONS, AUDIT_RESULTS, type AuditLogPage, type MemberListResponse } from '@knowguard/types';
import type { Metadata } from 'next';
import Link from 'next/link';

import { ACTION_LABELS, metadataText, resourceText, ResultBadge } from '@/components/audit/audit-labels';
import { dateFormat } from '@/components/documents/document-labels';
import { AccessDenied, PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { apiRequest } from '@/lib/api';
import { can } from '@/lib/permissions';
import { getSessionToken, requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Audit logs' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE_SIZE = 50;

type Params = Record<string, string | string[] | undefined>;
const one = (params: Params, key: string) => (typeof params[key] === 'string' ? params[key] : undefined);

/**
 * Filters live in the URL: they contain no sensitive text (audit entries never hold queries or
 * document content), and links to a filtered view are useful in investigations.
 */
function filtersFrom(params: Params) {
  const action = one(params, 'action');
  const result = one(params, 'result');
  const userId = one(params, 'userId');
  const resourceId = one(params, 'resourceId');
  const cursor = one(params, 'cursor');
  return {
    ...(action && (AUDIT_ACTIONS as readonly string[]).includes(action) ? { action } : {}),
    ...(result && (AUDIT_RESULTS as readonly string[]).includes(result) ? { result } : {}),
    ...(userId && UUID.test(userId) ? { userId } : {}),
    ...(resourceId && UUID.test(resourceId) ? { resourceId } : {}),
    ...(cursor && UUID.test(cursor) ? { cursor } : {}),
  };
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<Params> }) {
  const me = await requireUser();
  if (!can(me, 'audit.read')) return <AccessDenied what="audit logs" />;
  const token = await getSessionToken();
  const filters = filtersFrom(await searchParams);
  const query = new URLSearchParams({ ...filters, limit: String(PAGE_SIZE) });

  const [page, members] = await Promise.all([
    apiRequest<AuditLogPage>(`/audit-logs?${query}`, { token }),
    can(me, 'user.read')
      ? apiRequest<MemberListResponse>('/users', { token }).then((r) => r.members)
      : Promise.resolve([]),
  ]);
  const withoutCursor = Object.fromEntries(Object.entries(filters).filter(([key]) => key !== 'cursor'));
  const olderHref = page.nextCursor
    ? `/admin/audit?${new URLSearchParams({ ...withoutCursor, cursor: page.nextCursor })}`
    : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Audit logs"
        description="Security-relevant activity in your organization, newest first. Entries cannot be edited or deleted. Search queries, questions and document content are never recorded."
      />

      <form method="get" className="flex flex-wrap items-end gap-3" aria-label="Filter audit logs">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="audit-action">Event</Label>
          <Select id="audit-action" name="action" defaultValue={filters.action ?? ''}>
            <option value="">All events</option>
            {AUDIT_ACTIONS.map((action) => (
              <option key={action} value={action}>
                {ACTION_LABELS[action]}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="audit-result">Result</Label>
          <Select id="audit-result" name="result" defaultValue={filters.result ?? ''}>
            <option value="">Any result</option>
            {AUDIT_RESULTS.map((result) => (
              <option key={result} value={result}>
                {result.toLowerCase()}
              </option>
            ))}
          </Select>
        </div>
        {members.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="audit-user">Member</Label>
            <Select id="audit-user" name="userId" defaultValue={filters.userId ?? ''}>
              <option value="">Anyone</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name} ({member.email})
                </option>
              ))}
            </Select>
          </div>
        ) : null}
        {filters.resourceId ? <input type="hidden" name="resourceId" value={filters.resourceId} /> : null}
        <Button type="submit" variant="outline">
          Apply
        </Button>
        {Object.keys(withoutCursor).length > 0 ? (
          <Button asChild variant="ghost">
            <Link href="/admin/audit">Clear</Link>
          </Button>
        ) : null}
      </form>

      <Card className="py-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="audit-table">
            <thead className="border-b text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 text-left font-medium">
                  Time
                </th>
                <th scope="col" className="px-4 py-3 text-left font-medium">
                  Member
                </th>
                <th scope="col" className="px-4 py-3 text-left font-medium">
                  Event
                </th>
                <th scope="col" className="px-4 py-3 text-left font-medium">
                  Resource
                </th>
                <th scope="col" className="px-4 py-3 text-left font-medium">
                  Result
                </th>
                <th scope="col" className="px-4 py-3 text-left font-medium">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {page.entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                    No matching events.
                  </td>
                </tr>
              ) : (
                page.entries.map((entry) => (
                  <tr key={entry.id} className="align-top" data-testid="audit-row">
                    <td className="whitespace-nowrap px-4 py-2 tabular-nums text-muted-foreground">
                      <time dateTime={entry.createdAt}>{dateFormat.format(new Date(entry.createdAt))}</time>
                    </td>
                    <td className="px-4 py-2">
                      {entry.actor ? (
                        <Link
                          href={`/admin/audit?userId=${entry.actor.id}`}
                          className="hover:underline"
                          title={entry.actor.email ?? undefined}
                        >
                          {entry.actor.name ?? 'Deleted user'}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">System</span>
                      )}
                    </td>
                    <td className="px-4 py-2 font-medium">{ACTION_LABELS[entry.action]}</td>
                    <td className="px-4 py-2">
                      {entry.resourceType === 'DOCUMENT' && entry.resourceLabel ? (
                        <Link href={`/documents/${entry.resourceId}`} className="hover:underline">
                          {resourceText(entry)}
                        </Link>
                      ) : entry.resourceId ? (
                        <Link
                          href={`/admin/audit?resourceId=${entry.resourceId}`}
                          className="text-muted-foreground hover:underline"
                        >
                          {resourceText(entry)}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">{resourceText(entry)}</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <ResultBadge result={entry.result} />
                    </td>
                    <td className="max-w-md px-4 py-2 text-xs break-words text-muted-foreground">
                      {metadataText(entry.metadata)}
                      {entry.ip ? <span className="block">IP {entry.ip}</span> : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {olderHref ? (
        <Button asChild variant="outline" className="self-center">
          <Link href={olderHref}>Older events</Link>
        </Button>
      ) : null}
    </div>
  );
}

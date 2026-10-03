import type { DocumentListResponse, DocumentStatusValue } from '@knowguard/types';
import type { Metadata } from 'next';
import Link from 'next/link';

import { ActionForm } from '@/components/admin/action-form';
import {
  dateFormat,
  formatBytes,
  StatusBadge,
  visibilityLabel,
} from '@/components/documents/document-labels';
import { AccessDenied, PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { apiRequest } from '@/lib/api';
import { can } from '@/lib/permissions';
import { getSessionToken, requireUser } from '@/lib/session';

import { reindexDocumentAction } from '../../documents/actions';

export const metadata: Metadata = { title: 'Manage documents' };

const STATUSES: DocumentStatusValue[] = [
  'READY',
  'PROCESSING',
  'INDEXING',
  'FAILED',
  'UPLOADING',
  'ARCHIVED',
];
const PAGE_SIZE = 50;

type Params = Record<string, string | string[] | undefined>;
const one = (params: Params, key: string) => (typeof params[key] === 'string' ? params[key] : undefined);

/**
 * Document administration: status, visibility and sharing at a glance, failed indexing to retry.
 * Like everything else it lists only documents the administrator may read — holding admin
 * permissions never grants access to other people's private documents.
 */
export default async function AdminDocumentsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const me = await requireUser();
  if (!can(me, 'document.share')) return <AccessDenied what="document administration" />;
  const token = await getSessionToken();
  const params = await searchParams;
  const status = one(params, 'status');
  const q = one(params, 'q')?.trim().slice(0, 200);
  const page = Math.max(1, Math.min(10_000, Number(one(params, 'page')) || 1));
  const filters = {
    ...(status && (STATUSES as string[]).includes(status) ? { status } : {}),
    ...(q ? { q } : {}),
  };
  const data = await apiRequest<DocumentListResponse>(
    `/documents?${new URLSearchParams({ ...filters, page: String(page), pageSize: String(PAGE_SIZE) })}`,
    { token },
  );
  const pages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
  const pageHref = (n: number) => `/admin/documents?${new URLSearchParams({ ...filters, page: String(n) })}`;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Documents"
        description="Every document you can read, with its status, visibility and owner. Private documents of other members are not listed — administrators have no access to them either."
      />

      <form method="get" className="flex flex-wrap items-end gap-3" aria-label="Filter documents">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="docs-q">Title</Label>
          <Input id="docs-q" name="q" defaultValue={q ?? ''} placeholder="Contains…" maxLength={200} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="docs-status">Status</Label>
          <Select id="docs-status" name="status" defaultValue={filters.status ?? ''}>
            <option value="">Any status</option>
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {value.toLowerCase()}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="outline">
          Apply
        </Button>
        {Object.keys(filters).length > 0 ? (
          <Button asChild variant="ghost">
            <Link href="/admin/documents">Clear</Link>
          </Button>
        ) : null}
        <p className="ml-auto self-center text-sm text-muted-foreground" data-testid="documents-total">
          {data.total.toLocaleString()} {data.total === 1 ? 'document' : 'documents'}
        </p>
      </form>

      <Card className="py-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="admin-documents">
            <thead className="border-b text-xs text-muted-foreground">
              <tr>
                {['Title', 'Status', 'Visibility', 'Owner', 'Version', 'Size', 'Updated', ''].map(
                  (heading) => (
                    <th key={heading} scope="col" className="px-4 py-3 text-left font-medium">
                      {heading}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.documents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">
                    No matching documents.
                  </td>
                </tr>
              ) : (
                data.documents.map((doc) => (
                  <tr key={doc.id} className="align-top">
                    <td className="px-4 py-2">
                      <Link href={`/documents/${doc.id}`} className="font-medium hover:underline">
                        {doc.title}
                      </Link>
                      {doc.processingError ? (
                        <span className="block text-xs text-destructive">{doc.processingError}</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2">
                      <StatusBadge status={doc.status} />
                    </td>
                    <td className="px-4 py-2">{visibilityLabel(doc.visibility)}</td>
                    <td className="px-4 py-2">{doc.owner.id === me.user.id ? 'You' : doc.owner.name}</td>
                    <td className="px-4 py-2 tabular-nums">v{doc.version}</td>
                    <td className="px-4 py-2 tabular-nums">{formatBytes(doc.size)}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-muted-foreground">
                      {dateFormat.format(new Date(doc.updatedAt))}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end gap-2">
                        {doc.status === 'FAILED' && doc.capabilities.write ? (
                          <ActionForm
                            action={reindexDocumentAction}
                            hidden={{ documentId: doc.id }}
                            submitLabel="Retry"
                            pendingLabel="Retrying…"
                            variant="outline"
                            inline
                          />
                        ) : null}
                        {doc.capabilities.share ? (
                          <Button asChild size="sm" variant="ghost">
                            <Link href={`/documents/${doc.id}#sharing`}>Permissions</Link>
                          </Button>
                        ) : null}
                        {can(me, 'audit.read') ? (
                          <Button asChild size="sm" variant="ghost">
                            <Link href={`/admin/audit?resourceId=${doc.id}`}>History</Link>
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {pages > 1 ? (
        <nav aria-label="Pages" className="flex items-center justify-center gap-3 text-sm">
          {page > 1 ? (
            <Button asChild variant="outline" size="sm">
              <Link href={pageHref(page - 1)}>Previous</Link>
            </Button>
          ) : null}
          <span className="text-muted-foreground">
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <Button asChild variant="outline" size="sm">
              <Link href={pageHref(page + 1)}>Next</Link>
            </Button>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}

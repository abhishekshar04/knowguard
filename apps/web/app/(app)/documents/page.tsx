import type { DocumentListResponse } from '@knowguard/types';
import { FileText } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { ActionForm } from '@/components/admin/action-form';
import {
  dateFormat,
  formatBytes,
  StatusBadge,
  visibilityLabel,
} from '@/components/documents/document-labels';
import { VisibilityFields } from '@/components/documents/visibility-fields';
import { AccessDenied, PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiRequest } from '@/lib/api';
import { can } from '@/lib/permissions';
import { getSessionToken, requireUser } from '@/lib/session';
import { loadSubjectOptions } from '@/lib/subjects';

import { uploadDocumentAction } from './actions';

export const metadata: Metadata = { title: 'Documents' };

const PAGE_SIZE = 25;

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const me = await requireUser();
  if (!can(me, 'document.read')) return <AccessDenied what="documents" />;

  const page = Math.max(1, Number((await searchParams).page) || 1);
  const token = (await getSessionToken())!;
  const [list, subjects] = await Promise.all([
    apiRequest<DocumentListResponse>(`/documents?page=${page}&pageSize=${PAGE_SIZE}`, { token }),
    can(me, 'document.create') ? loadSubjectOptions(me, token) : Promise.resolve(null),
  ]);
  const pages = Math.max(1, Math.ceil(list.total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Documents"
        description={`${list.total} document${list.total === 1 ? '' : 's'} you can read. Documents you cannot read are never listed.`}
      />

      {subjects ? (
        <Card>
          <CardHeader>
            <CardTitle>Upload a document</CardTitle>
            <CardDescription>
              PDF, Word (.docx), Markdown or plain text, up to 25 MB. New documents are private until you
              share them.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ActionForm action={uploadDocumentAction} submitLabel="Upload" pendingLabel="Uploading…">
              <div className="flex flex-wrap gap-3">
                <div className="flex min-w-60 flex-1 flex-col gap-1.5">
                  <Label htmlFor="upload-file">File</Label>
                  <Input
                    id="upload-file"
                    name="file"
                    type="file"
                    required
                    accept=".pdf,.docx,.md,.markdown,.txt,application/pdf,text/plain,text/markdown"
                  />
                </div>
                <div className="flex min-w-60 flex-1 flex-col gap-1.5">
                  <Label htmlFor="upload-title">Title</Label>
                  <Input id="upload-title" name="title" placeholder="Defaults to the file name" />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="upload-description">Description (optional)</Label>
                <Input id="upload-description" name="description" />
              </div>
              <VisibilityFields idPrefix="upload" options={subjects} />
            </ActionForm>
          </CardContent>
        </Card>
      ) : null}

      <Card className="py-0">
        {list.documents.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground" data-testid="no-documents">
            No documents yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="documents-table">
              <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Title</th>
                  <th className="px-3 py-3 font-medium">Owner</th>
                  <th className="px-3 py-3 font-medium">Visibility</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Version</th>
                  <th className="px-5 py-3 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {list.documents.map((doc) => (
                  <tr key={doc.id} data-testid={`document-row-${doc.title}`}>
                    <td className="px-5 py-3">
                      <Link
                        href={`/documents/${doc.id}`}
                        className="flex items-center gap-2 font-medium hover:underline"
                      >
                        <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                        {doc.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">{formatBytes(doc.size)}</p>
                    </td>
                    <td className="px-3 py-3 text-xs">
                      {doc.owner.id === me.user.id ? 'You' : doc.owner.name}
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant="outline">{visibilityLabel(doc.visibility)}</Badge>
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={doc.status} />
                    </td>
                    <td className="px-3 py-3 tabular-nums">v{doc.version}</td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">
                      {dateFormat.format(new Date(doc.updatedAt))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {pages > 1 ? (
        <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
          {page > 1 ? <Link href={`/documents?page=${page - 1}`}>← Previous</Link> : <span />}
          <span className="text-muted-foreground">
            Page {page} of {pages}
          </span>
          {page < pages ? <Link href={`/documents?page=${page + 1}`}>Next →</Link> : <span />}
        </nav>
      ) : null}
    </div>
  );
}

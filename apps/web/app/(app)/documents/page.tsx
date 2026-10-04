import type { DocumentListResponse } from '@knowguard/types';
import { ChevronLeft, ChevronRight, FileText, Upload } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { ActionForm } from '@/components/admin/action-form';
import {
  dateFormat,
  DocumentIcon,
  formatBytes,
  StatusBadge,
  timeAgo,
  visibilityLabel,
} from '@/components/documents/document-labels';
import { VisibilityFields } from '@/components/documents/visibility-fields';
import { AccessDenied, EmptyState, PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiRequest } from '@/lib/api';
import { can } from '@/lib/permissions';
import { getSessionToken, requireUser } from '@/lib/session';
import { loadSubjectOptions } from '@/lib/subjects';
import { initials } from '@/lib/utils';

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
        actions={
          subjects ? (
            <Button asChild>
              <a href="#upload">
                <Upload aria-hidden />
                New document
              </a>
            </Button>
          ) : null
        }
      />

      {list.documents.length === 0 ? (
        <EmptyState icon={FileText} title="No documents yet">
          <span data-testid="no-documents">
            Documents you upload, or that others share with you, will appear here.
          </span>
        </EmptyState>
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="documents-table">
              <thead className="border-b bg-muted/60 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Title</th>
                  <th className="hidden px-3 py-3 font-medium md:table-cell">Owner</th>
                  <th className="hidden px-3 py-3 font-medium sm:table-cell">Visibility</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="hidden px-3 py-3 font-medium lg:table-cell">Version</th>
                  <th className="hidden px-5 py-3 font-medium md:table-cell">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {list.documents.map((doc) => (
                  <tr
                    key={doc.id}
                    data-testid={`document-row-${doc.title}`}
                    className="transition-colors hover:bg-accent/50"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <DocumentIcon mimeType={doc.mimeType} />
                        <div className="min-w-0">
                          <Link
                            href={`/documents/${doc.id}`}
                            className="font-medium underline-offset-4 hover:underline"
                          >
                            {doc.title}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            {formatBytes(doc.size)}
                            <span className="md:hidden">, updated {timeAgo(doc.updatedAt)}</span>
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-3 py-3 md:table-cell">
                      <span className="flex items-center gap-2 text-xs whitespace-nowrap">
                        <span
                          aria-hidden
                          className="flex size-6 items-center justify-center rounded-full bg-muted text-[10px] font-semibold"
                        >
                          {initials(doc.owner.name)}
                        </span>
                        {doc.owner.id === me.user.id ? 'You' : doc.owner.name}
                      </span>
                    </td>
                    <td className="hidden px-3 py-3 sm:table-cell">
                      <Badge variant="outline">{visibilityLabel(doc.visibility)}</Badge>
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={doc.status} />
                    </td>
                    <td className="hidden px-3 py-3 text-muted-foreground tabular-nums lg:table-cell">
                      v{doc.version}
                    </td>
                    <td
                      className="hidden px-5 py-3 text-xs whitespace-nowrap text-muted-foreground md:table-cell"
                      title={dateFormat.format(new Date(doc.updatedAt))}
                    >
                      {timeAgo(doc.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {pages > 1 ? (
        <nav aria-label="Pagination" className="flex items-center justify-between gap-3 text-sm">
          {page > 1 ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/documents?page=${page - 1}`}>
                <ChevronLeft aria-hidden />
                Previous
              </Link>
            </Button>
          ) : (
            <span />
          )}
          <span className="text-muted-foreground">
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/documents?page=${page + 1}`}>
                Next
                <ChevronRight aria-hidden />
              </Link>
            </Button>
          ) : (
            <span />
          )}
        </nav>
      ) : null}

      {subjects ? (
        <Card id="upload" className="scroll-mt-20">
          <CardHeader className="flex-row items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-signal-soft">
              <Upload className="size-5 text-signal" aria-hidden />
            </span>
            <div className="flex flex-col gap-1">
              <CardTitle>Upload a document</CardTitle>
              <CardDescription>
                PDF, Word (.docx), Markdown or plain text, up to 25 MB. New documents are private until you
                share them.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <ActionForm action={uploadDocumentAction} submitLabel="Upload" pendingLabel="Uploading…">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="upload-file">File</Label>
                  <Input
                    id="upload-file"
                    name="file"
                    type="file"
                    required
                    accept=".pdf,.docx,.md,.markdown,.txt,application/pdf,text/plain,text/markdown"
                    className="cursor-pointer border-dashed py-0 leading-[2.4rem] file:text-signal"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="upload-title">Title</Label>
                  <Input id="upload-title" name="title" placeholder="Defaults to the file name" />
                </div>
                <div className="flex flex-col gap-1.5 md:col-span-2">
                  <Label htmlFor="upload-description">Description (optional)</Label>
                  <Input
                    id="upload-description"
                    name="description"
                    placeholder="A line to help others find it"
                  />
                </div>
              </div>
              <VisibilityFields idPrefix="upload" options={subjects} />
            </ActionForm>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

import type { AclEntryView, DocumentDetails, DocumentPreviewResponse } from '@knowguard/types';
import { ChevronRight, Download, ExternalLink, FileText, Sparkles } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ActionForm } from '@/components/admin/action-form';
import { AutoRefresh } from '@/components/documents/auto-refresh';
import {
  dateFormat,
  DocumentIcon,
  formatBytes,
  StatusBadge,
  timeAgo,
  visibilityLabel,
} from '@/components/documents/document-labels';
import { VisibilityFields } from '@/components/documents/visibility-fields';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { ApiError, apiRequest } from '@/lib/api';
import { can } from '@/lib/permissions';
import { getSessionToken, requireUser } from '@/lib/session';
import { loadSubjectOptions, type SubjectOptions } from '@/lib/subjects';
import { cn } from '@/lib/utils';

import {
  addAclEntryAction,
  deleteDocumentAction,
  reindexDocumentAction,
  removeAclEntryAction,
  setVisibilityAction,
  updateDocumentAction,
  uploadVersionAction,
} from '../actions';

export const metadata: Metadata = { title: 'Document' };

const TEXT_TYPES = new Set(['text/plain', 'text/markdown']);

async function loadDocument(id: string, token: string): Promise<DocumentDetails> {
  try {
    return await apiRequest<DocumentDetails>(`/documents/${encodeURIComponent(id)}`, { token });
  } catch (error) {
    // Unreadable and missing documents are indistinguishable (404) by design.
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}

/**
 * First 64 KB of a text document, rendered as plain text (never as HTML). Uses the API's bounded
 * preview endpoint, so showing a preview is audited as a view, not a download.
 */
async function textPreview(doc: DocumentDetails, token: string): Promise<string | null> {
  if (!TEXT_TYPES.has(doc.mimeType)) return null;
  try {
    const { preview } = await apiRequest<DocumentPreviewResponse>(`/documents/${doc.id}/preview`, { token });
    if (!preview) return null;
    return preview.truncated ? `${preview.text}\n…` : preview.text;
  } catch {
    return null;
  }
}

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireUser();
  const token = (await getSessionToken())!;
  const doc = await loadDocument(id, token);
  const [preview, subjects] = await Promise.all([
    textPreview(doc, token),
    doc.capabilities.share ? loadSubjectOptions(me, token) : Promise.resolve(null),
  ]);
  const hidden = { documentId: doc.id };
  const current = doc.versions[0];

  const busy = doc.status === 'UPLOADING' || doc.status === 'PROCESSING' || doc.status === 'INDEXING';

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <ol className="flex items-center gap-1.5">
          <li>
            <Link href="/documents" className="hover:text-foreground">
              Documents
            </Link>
          </li>
          <li aria-hidden>
            <ChevronRight className="size-3.5" />
          </li>
          <li aria-current="page" className="truncate text-foreground">
            {doc.title}
          </li>
        </ol>
      </nav>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <DocumentIcon mimeType={doc.mimeType} className="size-12 rounded-xl text-xs" />
          <div className="flex min-w-0 flex-col gap-1.5">
            <h1 className="font-display text-[1.75rem] leading-[1.1] font-bold tracking-[-0.03em] break-words sm:text-[2rem]">
              {doc.title}
            </h1>
            {doc.description ? (
              <p className="text-[15px] leading-relaxed text-muted-foreground">{doc.description}</p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button asChild variant="outline">
            <a href={`/documents/${doc.id}/file`} data-testid="download-link">
              <Download aria-hidden />
              Download
            </a>
          </Button>
          {doc.mimeType === 'application/pdf' ? (
            <Button asChild variant="outline">
              <a href={`/documents/${doc.id}/file?inline=1`} target="_blank" rel="noopener noreferrer">
                <ExternalLink aria-hidden />
                Open
              </a>
            </Button>
          ) : null}
          {can(me, 'ai.query') && doc.status === 'READY' ? (
            <Button asChild>
              <Link href={`/ask?document=${doc.id}`} data-testid="ask-about-document">
                <Sparkles aria-hidden />
                Ask AI about this document
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <AutoRefresh active={busy} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Preview</CardTitle>
            </CardHeader>
            <CardContent>
              {preview !== null ? (
                <pre
                  data-testid="document-preview"
                  className="max-h-[28rem] overflow-auto rounded-xl border bg-muted/60 p-4 font-mono text-[13px] leading-relaxed whitespace-pre-wrap"
                >
                  {preview}
                </pre>
              ) : (
                <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
                  <FileText className="size-5" aria-hidden />
                  {doc.mimeType === 'application/pdf'
                    ? 'Use “Open” to view this PDF in your browser.'
                    : 'No preview for this file type. Download it to view.'}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Versions</CardTitle>
              <CardDescription>Every upload is kept as an immutable version.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <ol className="flex flex-col" data-testid="versions">
                {doc.versions.map((version, index) => (
                  <li key={version.id} className="relative flex gap-3 pb-4 last:pb-0">
                    {index < doc.versions.length - 1 ? (
                      <span aria-hidden className="absolute top-8 bottom-0 left-[15px] w-px bg-border" />
                    ) : null}
                    <span
                      className={cn(
                        'relative flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums',
                        index === 0 ? 'bg-ink text-white' : 'border bg-card text-muted-foreground',
                      )}
                    >
                      v{version.version}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-2 pt-1">
                      <span className="min-w-0 text-sm">
                        <span className="block truncate font-medium">{version.originalFilename}</span>
                        <span className="block text-xs text-muted-foreground">
                          {version.createdBy.name}, {dateFormat.format(new Date(version.createdAt))},{' '}
                          {formatBytes(version.size)}
                        </span>
                      </span>
                      <a
                        className="inline-flex items-center gap-1 text-xs font-medium text-signal underline-offset-4 hover:underline"
                        href={`/documents/${doc.id}/file?version=${version.id}`}
                      >
                        <Download className="size-3.5" aria-hidden />
                        Download v{version.version}
                      </a>
                    </div>
                  </li>
                ))}
              </ol>
              {doc.capabilities.write ? (
                <div className="border-t pt-4">
                  <ActionForm
                    action={uploadVersionAction}
                    hidden={hidden}
                    submitLabel="Upload new version"
                    variant="outline"
                    inline
                  >
                    <Input
                      name="file"
                      type="file"
                      required
                      aria-label="New version file"
                      className="min-w-0 flex-1 cursor-pointer border-dashed py-0 leading-[2.4rem] file:text-signal"
                    />
                  </ActionForm>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {doc.capabilities.write ? (
            <Card>
              <CardHeader>
                <CardTitle>Details</CardTitle>
                <CardDescription>How this document is named and described to others.</CardDescription>
              </CardHeader>
              <CardContent>
                <ActionForm action={updateDocumentAction} hidden={hidden} submitLabel="Save details">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="doc-title">Title</Label>
                      <Input id="doc-title" name="title" defaultValue={doc.title} required />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="doc-description">Description</Label>
                      <Input id="doc-description" name="description" defaultValue={doc.description ?? ''} />
                    </div>
                  </div>
                </ActionForm>
              </CardContent>
            </Card>
          ) : null}

          {doc.capabilities.share && subjects ? <SharingCard doc={doc} subjects={subjects} /> : null}
        </div>

        <aside className="flex flex-col gap-6">
          <Card className="lg:sticky lg:top-20">
            <CardHeader>
              <CardTitle>Properties</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <dl className="flex flex-col divide-y text-sm">
                <Detail label="Status">
                  <StatusBadge status={doc.status} />
                </Detail>
                <p
                  className="py-2.5 text-xs leading-relaxed text-muted-foreground"
                  data-testid="indexing-detail"
                >
                  {doc.status === 'READY'
                    ? `${doc.chunkCount} passage${doc.chunkCount === 1 ? '' : 's'} indexed${
                        doc.indexedAt ? ` · ${dateFormat.format(new Date(doc.indexedAt))}` : ''
                      }`
                    : doc.status === 'FAILED'
                      ? (doc.processingError ?? 'Indexing failed.')
                      : 'Extracting and indexing text…'}
                </p>
                <Detail label="Owner">{doc.owner.id === me.user.id ? 'You' : doc.owner.name}</Detail>
                <Detail label="Visibility">
                  <span className="text-right">
                    <span data-testid="document-visibility">{visibilityLabel(doc.visibility)}</span>
                    {doc.audience.length > 0 ? (
                      <span className="block text-xs font-normal text-muted-foreground">
                        {doc.audience.map((a) => a.name).join(', ')}
                      </span>
                    ) : null}
                  </span>
                </Detail>
                <Detail label="Version">v{doc.version}</Detail>
                <Detail label="Updated">
                  <span title={dateFormat.format(new Date(doc.updatedAt))}>{timeAgo(doc.updatedAt)}</span>
                </Detail>
                <Detail label="Size">{formatBytes(doc.size)}</Detail>
                <Detail label="Type">
                  <span className="truncate">{doc.mimeType}</span>
                </Detail>
                <Detail label="Fingerprint">
                  <code className="text-xs" title={current?.contentHash}>
                    sha256:{current?.contentHash.slice(0, 12)}…
                  </code>
                </Detail>
              </dl>
              {doc.capabilities.write && (doc.status === 'FAILED' || doc.status === 'READY') ? (
                <ActionForm
                  action={reindexDocumentAction}
                  hidden={{ documentId: doc.id }}
                  submitLabel={doc.status === 'FAILED' ? 'Retry indexing' : 'Reindex'}
                  variant="outline"
                />
              ) : null}
            </CardContent>
          </Card>
        </aside>
      </div>

      {doc.capabilities.delete ? (
        <Card className="border-destructive/25">
          <CardHeader>
            <CardTitle className="text-destructive">Delete this document</CardTitle>
            <CardDescription>
              Permanently deletes the document, all versions and all sharing settings. This can’t be undone.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ActionForm
              action={deleteDocumentAction}
              hidden={hidden}
              submitLabel="Delete document"
              variant="destructive"
            >
              <label className="flex items-center gap-2.5 text-sm">
                <input type="checkbox" required className="size-4 accent-[var(--destructive)]" />I understand
                this permanently deletes “{doc.title}”.
              </label>
            </ActionForm>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 justify-end font-medium">{children}</dd>
    </div>
  );
}

function SharingCard({ doc, subjects }: { doc: DocumentDetails; subjects: SubjectOptions }) {
  const hidden = { documentId: doc.id };
  const entryKey = (entry: AclEntryView) => `${entry.subject.type}:${entry.subject.id}:${entry.permission}`;
  const groups: Array<[string, SubjectOptions[keyof SubjectOptions]]> = [
    ['People', subjects.users],
    ['Teams', subjects.teams],
    ['Departments', subjects.departments],
    ['Roles', subjects.roles],
  ];
  return (
    <Card id="sharing" data-testid="sharing">
      <CardHeader>
        <CardTitle>Sharing</CardTitle>
        <CardDescription>
          Visibility decides who can read the document. Explicit entries grant more (edit, delete, share) or
          deny access — a deny always wins.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <ActionForm action={setVisibilityAction} hidden={hidden} submitLabel="Save visibility">
          <VisibilityFields
            idPrefix="share"
            options={subjects}
            visibility={doc.visibility}
            audience={doc.audience}
          />
        </ActionForm>

        <div className="flex flex-col gap-3 border-t pt-4">
          <div>
            <p className="text-sm font-medium">Explicit access</p>
            <p className="text-xs text-muted-foreground">Grant extra rights, or deny someone outright.</p>
          </div>
          {(doc.acl ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No explicit entries.</p>
          ) : null}
          <ul className="flex flex-col gap-1" data-testid="acl-entries">
            {(doc.acl ?? []).map((entry) => (
              <li
                key={entryKey(entry)}
                className="flex items-center justify-between gap-2 rounded-xl border px-3 py-1.5 text-sm"
              >
                <span>
                  <Badge variant={entry.effect === 'DENY' ? 'destructive' : 'secondary'}>
                    {entry.effect === 'DENY' ? 'deny' : 'allow'} {entry.permission.toLowerCase()}
                  </Badge>{' '}
                  {entry.subject.name}{' '}
                  <span className="text-xs text-muted-foreground">({entry.subject.type.toLowerCase()})</span>
                </span>
                <ActionForm
                  action={removeAclEntryAction}
                  hidden={{ ...hidden, entry: entryKey(entry) }}
                  submitLabel="Remove"
                  variant="ghost"
                  quiet
                />
              </li>
            ))}
          </ul>
          <ActionForm action={addAclEntryAction} hidden={hidden} submitLabel="Add" variant="outline" inline>
            <Select name="subject" aria-label="Share with" className="min-w-0 flex-1">
              {groups.map(([label, refs]) =>
                refs.length > 0 ? (
                  <optgroup key={label} label={label}>
                    {refs.map((ref) => (
                      <option key={`${ref.type}:${ref.id}`} value={`${ref.type}:${ref.id}`}>
                        {ref.name}
                      </option>
                    ))}
                  </optgroup>
                ) : null,
              )}
            </Select>
            <Select name="permission" aria-label="Permission" defaultValue="READ">
              <option value="READ">can read</option>
              <option value="WRITE">can edit</option>
              <option value="DELETE">can delete</option>
              <option value="SHARE">can share</option>
            </Select>
            <Select name="effect" aria-label="Effect" defaultValue="ALLOW">
              <option value="ALLOW">allow</option>
              <option value="DENY">deny</option>
            </Select>
          </ActionForm>
        </div>
      </CardContent>
    </Card>
  );
}

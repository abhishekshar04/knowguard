import type { AclEntryView, DocumentDetails, DocumentPreviewResponse } from '@knowguard/types';
import { Bot, Download, ExternalLink } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ActionForm } from '@/components/admin/action-form';
import { AutoRefresh } from '@/components/documents/auto-refresh';
import {
  dateFormat,
  formatBytes,
  StatusBadge,
  visibilityLabel,
} from '@/components/documents/document-labels';
import { VisibilityFields } from '@/components/documents/visibility-fields';
import { PageHeader } from '@/components/page-header';
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

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={doc.title}
        description={doc.description ?? undefined}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={`/documents/${doc.id}/file`} data-testid="download-link">
                <Download aria-hidden />
                Download
              </a>
            </Button>
            {doc.mimeType === 'application/pdf' ? (
              <Button asChild variant="outline" size="sm">
                <a href={`/documents/${doc.id}/file?inline=1`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink aria-hidden />
                  Open
                </a>
              </Button>
            ) : null}
            {can(me, 'ai.query') && doc.status === 'READY' ? (
              <Button asChild size="sm">
                <Link href={`/ask?document=${doc.id}`} data-testid="ask-about-document">
                  <Bot aria-hidden />
                  Ask AI about this document
                </Link>
              </Button>
            ) : null}
          </div>
        }
      />

      <Card>
        <CardContent>
          <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <Detail label="Owner">{doc.owner.id === me.user.id ? 'You' : doc.owner.name}</Detail>
            <Detail label="Visibility">
              <span data-testid="document-visibility">{visibilityLabel(doc.visibility)}</span>
              {doc.audience.length > 0 ? (
                <span className="block text-xs text-muted-foreground">
                  {doc.audience.map((a) => a.name).join(', ')}
                </span>
              ) : null}
            </Detail>
            <Detail label="Version">v{doc.version}</Detail>
            <Detail label="Last updated">{dateFormat.format(new Date(doc.updatedAt))}</Detail>
            <Detail label="Status">
              <StatusBadge status={doc.status} />
              <span className="block text-xs text-muted-foreground" data-testid="indexing-detail">
                {doc.status === 'READY'
                  ? `${doc.chunkCount} passage${doc.chunkCount === 1 ? '' : 's'} indexed${
                      doc.indexedAt ? ` · ${dateFormat.format(new Date(doc.indexedAt))}` : ''
                    }`
                  : doc.status === 'FAILED'
                    ? (doc.processingError ?? 'Indexing failed.')
                    : 'Extracting and indexing text…'}
              </span>
            </Detail>
            <Detail label="Type">{doc.mimeType}</Detail>
            <Detail label="Size">{formatBytes(doc.size)}</Detail>
            <Detail label="Fingerprint">
              <code className="text-xs" title={current?.contentHash}>
                sha256:{current?.contentHash.slice(0, 12)}…
              </code>
            </Detail>
          </dl>
        </CardContent>
      </Card>

      <AutoRefresh
        active={doc.status === 'UPLOADING' || doc.status === 'PROCESSING' || doc.status === 'INDEXING'}
      />
      {doc.capabilities.write && (doc.status === 'FAILED' || doc.status === 'READY') ? (
        <ActionForm
          action={reindexDocumentAction}
          hidden={{ documentId: doc.id }}
          submitLabel={doc.status === 'FAILED' ? 'Retry indexing' : 'Reindex'}
          variant="outline"
          className="self-start"
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
        </CardHeader>
        <CardContent>
          {preview !== null ? (
            <pre
              data-testid="document-preview"
              className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-4 font-mono text-xs"
            >
              {preview}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">
              {doc.mimeType === 'application/pdf'
                ? 'Use “Open” to view this PDF in your browser.'
                : 'No preview for this file type. Download it to view.'}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Versions</CardTitle>
          <CardDescription>Every upload is kept as an immutable version.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ul className="divide-y text-sm" data-testid="versions">
            {doc.versions.map((version) => (
              <li key={version.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <span className="font-medium tabular-nums">v{version.version}</span> ·{' '}
                  {version.originalFilename} · {formatBytes(version.size)}
                  <span className="block text-xs text-muted-foreground">
                    {version.createdBy.name}, {dateFormat.format(new Date(version.createdAt))}
                  </span>
                </span>
                <a
                  className="text-xs underline-offset-4 hover:underline"
                  href={`/documents/${doc.id}/file?version=${version.id}`}
                >
                  Download v{version.version}
                </a>
              </li>
            ))}
          </ul>
          {doc.capabilities.write ? (
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
                className="min-w-0 flex-1"
              />
            </ActionForm>
          ) : null}
        </CardContent>
      </Card>

      {doc.capabilities.write ? (
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <ActionForm action={updateDocumentAction} hidden={hidden} submitLabel="Save details">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="doc-title">Title</Label>
                <Input id="doc-title" name="title" defaultValue={doc.title} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="doc-description">Description</Label>
                <Input id="doc-description" name="description" defaultValue={doc.description ?? ''} />
              </div>
            </ActionForm>
          </CardContent>
        </Card>
      ) : null}

      {doc.capabilities.share && subjects ? <SharingCard doc={doc} subjects={subjects} /> : null}

      {doc.capabilities.delete ? (
        <Card>
          <CardHeader>
            <CardTitle>Delete</CardTitle>
            <CardDescription>
              Permanently deletes the document, all versions and all sharing settings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ActionForm
              action={deleteDocumentAction}
              hidden={hidden}
              submitLabel="Delete document"
              variant="outline"
            />
          </CardContent>
        </Card>
      ) : null}

      <p className="text-xs text-muted-foreground">
        <Link href="/documents" className="underline-offset-4 hover:underline">
          ← All documents
        </Link>
      </p>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{children}</dd>
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
          <p className="text-sm font-medium">Explicit access</p>
          {(doc.acl ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No explicit entries.</p>
          ) : null}
          <ul className="flex flex-col gap-1" data-testid="acl-entries">
            {(doc.acl ?? []).map((entry) => (
              <li key={entryKey(entry)} className="flex items-center justify-between gap-2 text-sm">
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

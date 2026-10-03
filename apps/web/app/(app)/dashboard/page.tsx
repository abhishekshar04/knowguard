import type {
  AnalyticsOverview,
  ConversationListResponse,
  DependencyStatus,
  DocumentListResponse,
} from '@knowguard/types';
import {
  Bot,
  CheckCircle2,
  CircleAlert,
  CircleX,
  FileText,
  MailWarning,
  MessageSquare,
  Search,
  Upload,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { StatusBadge } from '@/components/documents/document-labels';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiRequest, getApiHealth } from '@/lib/api';
import { can } from '@/lib/permissions';
import { getSessionToken, requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Dashboard' };
// Health is live data; never prerender it at build time.
export const dynamic = 'force-dynamic';

function StatusRow({ label, status }: { label: string; status: DependencyStatus | 'unreachable' }) {
  const up = status === 'up';
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm">{label}</span>
      <Badge variant={up ? 'success' : 'destructive'}>
        {up ? <CheckCircle2 aria-hidden /> : <CircleX aria-hidden />}
        {status}
      </Badge>
    </div>
  );
}

export default async function DashboardPage() {
  const [me, result] = await Promise.all([requireUser(), getApiHealth()]);
  const token = await getSessionToken();
  const optional = <T,>(promise: Promise<T>, fallback: T) => promise.catch(() => fallback);
  const [recentDocuments, conversations, weekly] = await Promise.all([
    can(me, 'document.read')
      ? optional(
          apiRequest<DocumentListResponse>('/documents?pageSize=5', { token }).then((r) => r.documents),
          [],
        )
      : [],
    can(me, 'ai.query')
      ? optional(
          apiRequest<ConversationListResponse>('/ai/conversations', { token }).then((r) =>
            r.conversations.slice(0, 5),
          ),
          [],
        )
      : [],
    can(me, 'audit.read')
      ? optional(
          apiRequest<AnalyticsOverview>('/analytics/overview?days=7', { token }).then((o) => ({
            searches: o.activity.reduce((n, d) => n + d.searches, 0),
            aiQueries: o.activity.reduce((n, d) => n + d.aiQueries, 0),
            denied: o.activity.reduce((n, d) => n + d.denied, 0),
          })),
          null,
        )
      : null,
  ]);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome, {me.user.name}</h1>
        <p className="text-sm text-muted-foreground">
          Permission-aware enterprise knowledge. Every answer is built only from documents you are allowed to
          read.
        </p>
      </header>

      {!me.user.emailVerified && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm"
        >
          <MailWarning className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            <span className="font-medium">Your email address is not verified.</span> Some organization
            actions, such as inviting users and sharing documents, will require a verified email.
          </p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Your account</CardTitle>
          <CardDescription>Resolved server-side from your session.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="truncate font-medium">{me.user.email}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Organization</dt>
              <dd className="font-medium" data-testid="organization-name">
                {me.organization.name}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Role</dt>
              <dd className="flex flex-wrap gap-1" data-testid="roles">
                {me.roles.map((role) => (
                  <Badge key={role} variant="secondary">
                    {role}
                  </Badge>
                ))}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Permissions</dt>
              <dd className="font-medium">{me.permissions.length}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link href="/search">
            <Search aria-hidden />
            Search documents
          </Link>
        </Button>
        {can(me, 'ai.query') ? (
          <Button asChild variant="outline">
            <Link href="/ask">
              <Bot aria-hidden />
              Ask AI
            </Link>
          </Button>
        ) : null}
        {can(me, 'document.create') ? (
          <Button asChild variant="outline">
            <Link href="/documents">
              <Upload aria-hidden />
              Upload a document
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recently updated documents</CardTitle>
            <CardDescription>Only documents you can read.</CardDescription>
          </CardHeader>
          <CardContent>
            {recentDocuments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No documents yet.</p>
            ) : (
              <ul className="flex flex-col gap-2" data-testid="recent-documents">
                {recentDocuments.map((doc) => (
                  <li key={doc.id} className="flex items-center justify-between gap-3 text-sm">
                    <Link
                      href={`/documents/${doc.id}`}
                      className="flex min-w-0 items-center gap-2 hover:underline"
                    >
                      <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="truncate">{doc.title}</span>
                    </Link>
                    <StatusBadge status={doc.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {can(me, 'ai.query') ? (
          <Card>
            <CardHeader>
              <CardTitle>Your recent conversations</CardTitle>
              <CardDescription>Private to you.</CardDescription>
            </CardHeader>
            <CardContent>
              {conversations.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No conversations yet.{' '}
                  <Link href="/ask" className="underline">
                    Ask a question
                  </Link>
                  .
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {conversations.map((c) => (
                    <li key={c.id} className="text-sm">
                      <Link
                        href={`/ask?c=${c.id}`}
                        className="flex min-w-0 items-center gap-2 hover:underline"
                      >
                        <MessageSquare className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="truncate">{c.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>System status</CardTitle>
            <CardDescription>Live readiness of the API and its dependencies.</CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            {result.reachable ? (
              <>
                <StatusRow label="API" status="up" />
                <StatusRow label="PostgreSQL" status={result.health.checks.database} />
                <StatusRow label="Redis" status={result.health.checks.redis} />
                <StatusRow label="Object storage" status={result.health.checks.storage} />
                <p className="pt-3 text-xs text-muted-foreground">
                  API v{result.health.version} · up {result.health.uptimeSeconds}s
                </p>
              </>
            ) : (
              <div className="flex items-start gap-2 py-2 text-sm text-destructive">
                <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  The API is unreachable. Start it with <code className="font-mono">pnpm dev</code> and check{' '}
                  <code className="font-mono">API_URL</code>.
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {weekly ? (
          <Card data-testid="weekly-activity">
            <CardHeader>
              <CardTitle>Last 7 days</CardTitle>
              <CardDescription>Organization activity from the audit log.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <dl className="grid grid-cols-3 gap-3 text-sm">
                {[
                  ['Searches', weekly.searches],
                  ['AI questions', weekly.aiQueries],
                  ['Access denied', weekly.denied],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="text-xl font-semibold tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>
              <Link href="/admin/analytics" className="text-sm hover:underline">
                Open analytics →
              </Link>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

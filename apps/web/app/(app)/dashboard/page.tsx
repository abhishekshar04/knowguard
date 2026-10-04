import type {
  AnalyticsOverview,
  ConversationListResponse,
  DependencyStatus,
  DocumentListResponse,
} from '@knowguard/types';
import {
  ArrowRight,
  CircleAlert,
  FileText,
  MailWarning,
  MessageSquare,
  Search,
  Sparkles,
  Upload,
  type LucideIcon,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { DocumentIcon, StatusBadge, timeAgo } from '@/components/documents/document-labels';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiRequest, getApiHealth } from '@/lib/api';
import { can } from '@/lib/permissions';
import { getSessionToken, requireUser } from '@/lib/session';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Dashboard' };
// Health is live data; never prerender it at build time.
export const dynamic = 'force-dynamic';

function StatusRow({ label, status }: { label: string; status: DependencyStatus | 'unreachable' }) {
  const up = status === 'up';
  return (
    <div className="flex items-center justify-between py-2 text-sm">
      <span className="flex items-center gap-2.5">
        <span aria-hidden className={cn('size-2 rounded-full', up ? 'bg-success' : 'bg-destructive')} />
        {label}
      </span>
      <span className={cn('text-xs', up ? 'text-muted-foreground' : 'font-medium text-destructive')}>
        {up ? 'Operational' : status}
      </span>
    </div>
  );
}

function QuickAction({
  href,
  icon: Icon,
  title,
  text,
  primary,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  text: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'group flex flex-col gap-4 rounded-2xl border p-5 outline-none transition-[border-color,box-shadow] focus-visible:ring-[3px] focus-visible:ring-ring/30',
        primary
          ? 'border-transparent bg-ink text-white hover:shadow-[0_18px_40px_-20px_rgb(11_13_18/0.6)]'
          : 'bg-card hover:border-foreground/20',
      )}
    >
      <span
        className={cn(
          'flex size-10 items-center justify-center rounded-xl',
          primary ? 'bg-white/10 text-white' : 'bg-signal-soft text-signal',
        )}
      >
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="flex flex-col gap-1">
        <span className="flex items-center gap-1.5 font-semibold">
          {title}
          <ArrowRight
            className="size-4 opacity-0 transition-[opacity,transform] group-hover:translate-x-0.5 group-hover:opacity-100"
            aria-hidden
          />
        </span>
        <span className={cn('text-sm leading-relaxed', primary ? 'text-white/65' : 'text-muted-foreground')}>
          {text}
        </span>
      </span>
    </Link>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
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

  const firstName = me.user.name.split(/\s+/)[0] ?? me.user.name;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1.5">
        <p className="text-sm text-muted-foreground">
          {greeting()}, {firstName}
        </p>
        <h1 className="font-display text-[1.9rem] leading-[1.1] font-bold tracking-[-0.03em] sm:text-[2.25rem]">
          Welcome, {me.user.name}
        </h1>
        <p className="max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
          Every answer and search result here is built only from documents you are allowed to read.
        </p>
      </header>

      {!me.user.emailVerified && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-warning/25 bg-warning/[0.07] px-4 py-3 text-sm"
        >
          <MailWarning className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <p>
            <span className="font-medium">Your email address is not verified.</span> Some organization
            actions, such as inviting users and sharing documents, will require a verified email.
          </p>
        </div>
      )}

      <section aria-label="Quick actions" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {can(me, 'ai.query') ? (
          <QuickAction
            primary
            href="/ask"
            icon={Sparkles}
            title="Ask AI"
            text="Get an answer with sources, from documents you can read."
          />
        ) : null}
        <QuickAction
          href="/search"
          icon={Search}
          title="Search documents"
          text="Find exact terms or ideas across your knowledge."
          primary={!can(me, 'ai.query')}
        />
        {can(me, 'document.create') ? (
          <QuickAction
            href="/documents"
            icon={Upload}
            title="Upload a document"
            text="PDF, Word, Markdown or text. You choose who can read it."
          />
        ) : null}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card className="gap-2">
            <CardHeader className="flex-row items-center justify-between gap-3">
              <div className="flex flex-col gap-1">
                <CardTitle>Recently updated documents</CardTitle>
                <CardDescription>Only documents you can read.</CardDescription>
              </div>
              <Link href="/documents" className="shrink-0 text-sm font-medium text-signal hover:underline">
                View all
              </Link>
            </CardHeader>
            <CardContent className="px-2">
              {recentDocuments.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">No documents yet.</p>
              ) : (
                <ul className="flex flex-col" data-testid="recent-documents">
                  {recentDocuments.map((doc) => (
                    <li key={doc.id}>
                      <Link
                        href={`/documents/${doc.id}`}
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-accent"
                      >
                        <DocumentIcon mimeType={doc.mimeType} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{doc.title}</span>
                          <span className="block text-xs text-muted-foreground">
                            Updated {timeAgo(doc.updatedAt)}
                          </span>
                        </span>
                        <StatusBadge status={doc.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {can(me, 'ai.query') ? (
            <Card className="gap-2">
              <CardHeader className="flex-row items-center justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <CardTitle>Your recent conversations</CardTitle>
                  <CardDescription>Private to you.</CardDescription>
                </div>
                <Link href="/ask" className="shrink-0 text-sm font-medium text-signal hover:underline">
                  New question
                </Link>
              </CardHeader>
              <CardContent className="px-2">
                {conversations.length === 0 ? (
                  <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                    No conversations yet.{' '}
                    <Link href="/ask" className="font-medium text-signal hover:underline">
                      Ask a question
                    </Link>
                    .
                  </p>
                ) : (
                  <ul className="flex flex-col">
                    {conversations.map((c) => (
                      <li key={c.id}>
                        <Link
                          href={`/ask?c=${c.id}`}
                          className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-accent"
                        >
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                            <MessageSquare className="size-4 text-muted-foreground" aria-hidden />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{c.title}</span>
                            <span className="block text-xs text-muted-foreground">
                              {timeAgo(c.updatedAt)}
                            </span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Your access</CardTitle>
              <CardDescription>Resolved server-side from your session.</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="flex flex-col gap-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Organization</dt>
                  <dd className="truncate font-medium" data-testid="organization-name">
                    {me.organization.name}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Email</dt>
                  <dd className="truncate font-medium">{me.user.email}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Role</dt>
                  <dd className="flex flex-wrap justify-end gap-1" data-testid="roles">
                    {me.roles.map((role) => (
                      <Badge key={role} variant="secondary">
                        {role}
                      </Badge>
                    ))}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Permissions</dt>
                  <dd className="font-medium tabular-nums">{me.permissions.length}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {weekly ? (
            <Card data-testid="weekly-activity">
              <CardHeader>
                <CardTitle>Last 7 days</CardTitle>
                <CardDescription>Organization activity from the audit log.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <dl className="grid grid-cols-3 gap-3">
                  {[
                    ['Searches', weekly.searches],
                    ['AI questions', weekly.aiQueries],
                    ['Denied', weekly.denied],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl bg-muted px-3 py-2.5">
                      <dt className="text-xs text-muted-foreground">{label}</dt>
                      <dd className="font-display text-xl font-bold tabular-nums">{value}</dd>
                    </div>
                  ))}
                </dl>
                <Link
                  href="/admin/analytics"
                  className="inline-flex items-center gap-1 text-sm font-medium text-signal hover:underline"
                >
                  Open analytics
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </CardContent>
            </Card>
          ) : null}

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
                    API v{result.health.version}, up {result.health.uptimeSeconds}s
                  </p>
                </>
              ) : (
                <div className="flex items-start gap-2 py-2 text-sm text-destructive">
                  <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>
                    The API is unreachable. Start it with <code className="font-mono">pnpm dev</code> and
                    check <code className="font-mono">API_URL</code>.
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <FileText className="size-3.5" aria-hidden />
        Tip: press <kbd className="rounded border bg-card px-1.5 font-sans">/</kbd> anywhere to search.
      </p>
    </div>
  );
}

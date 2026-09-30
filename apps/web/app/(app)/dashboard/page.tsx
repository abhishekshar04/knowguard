import type { DependencyStatus } from '@knowguard/types';
import { CheckCircle2, CircleAlert, CircleX, MailWarning } from 'lucide-react';
import type { Metadata } from 'next';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getApiHealth } from '@/lib/api';
import { requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Dashboard' };
// Health is live data; never prerender it at build time.
export const dynamic = 'force-dynamic';

const ROADMAP = [
  { phase: 1, name: 'Foundation', detail: 'Monorepo, API, worker, database, seed' },
  { phase: 2, name: 'Authentication', detail: 'Register, login, sessions' },
  { phase: 3, name: 'Multi-tenancy', detail: 'Organizations, users, departments, teams' },
  { phase: 4, name: 'Authorization', detail: 'RBAC, ACLs, policy engine' },
  { phase: 5, name: 'Documents', detail: 'Upload, storage, versions, permissions' },
  { phase: 6, name: 'Ingestion', detail: 'Extraction, chunking, embeddings' },
  { phase: 7, name: 'Search', detail: 'Keyword, vector, hybrid' },
  { phase: 8, name: 'AI', detail: 'Permission-aware RAG with citations' },
] as const;
const CURRENT_PHASE = 7;

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

        <Card>
          <CardHeader>
            <CardTitle>Build roadmap</CardTitle>
            <CardDescription>Security and tenancy are proven before any AI is added.</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="flex flex-col gap-2">
              {ROADMAP.map((item) => (
                <li key={item.phase} className="flex items-center gap-3 text-sm">
                  <span className="w-5 text-right tabular-nums text-muted-foreground">{item.phase}</span>
                  <span className="flex-1">
                    <span className="font-medium">{item.name}</span>{' '}
                    <span className="text-muted-foreground">— {item.detail}</span>
                  </span>
                  {item.phase < CURRENT_PHASE ? (
                    <Badge variant="success">done</Badge>
                  ) : item.phase === CURRENT_PHASE ? (
                    <Badge variant="secondary">current</Badge>
                  ) : null}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

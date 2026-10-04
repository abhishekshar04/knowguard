import type { OrganizationDetails } from '@knowguard/types';
import type { Metadata } from 'next';

import { ActionForm } from '@/components/admin/action-form';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiRequest } from '@/lib/api';
import { can } from '@/lib/permissions';
import { getSessionToken, requireUser } from '@/lib/session';
import { initials } from '@/lib/utils';

import { renameOrganizationAction } from '../admin/actions';

export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const me = await requireUser();
  const organization = can(me, 'organization.read')
    ? await apiRequest<OrganizationDetails>('/organization', { token: await getSessionToken() })
    : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Settings" description="Your account and your organization." />

      <Card>
        <CardHeader>
          <CardTitle>Your account</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex items-center gap-4">
            <span
              aria-hidden
              className="flex size-14 shrink-0 items-center justify-center rounded-full bg-ink font-display text-lg font-semibold text-white"
            >
              {initials(me.user.name)}
            </span>
            <div className="min-w-0">
              <p className="font-display text-lg font-semibold tracking-tight">{me.user.name}</p>
              <p className="truncate text-sm text-muted-foreground">{me.user.email}</p>
            </div>
          </div>
          <dl className="grid gap-4 rounded-xl border bg-muted/40 p-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">Name</dt>
              <dd className="font-medium">{me.user.name}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="flex items-center gap-2 font-medium">
                <span className="truncate">{me.user.email}</span>
                <Badge variant={me.user.emailVerified ? 'success' : 'secondary'}>
                  {me.user.emailVerified ? 'verified' : 'unverified'}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Role</dt>
              <dd className="font-medium">{me.roles.join(', ')}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {organization ? (
        <Card>
          <CardHeader>
            <CardTitle>Organization</CardTitle>
            <CardDescription>
              {organization.memberCount} member{organization.memberCount === 1 ? '' : 's'} · identifier{' '}
              <code className="font-mono">{organization.slug}</code>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {can(me, 'organization.update') ? (
              <ActionForm action={renameOrganizationAction} submitLabel="Save" inline>
                <div className="flex min-w-60 flex-1 flex-col gap-1.5">
                  <Label htmlFor="organization-name">Organization name</Label>
                  <Input id="organization-name" name="name" defaultValue={organization.name} required />
                </div>
              </ActionForm>
            ) : (
              <p className="text-sm">
                <span className="text-muted-foreground">Name:</span> {organization.name}
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

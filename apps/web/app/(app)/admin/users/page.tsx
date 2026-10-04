import type {
  MemberListResponse,
  MemberStatus,
  MemberSummary,
  RoleListResponse,
  RoleSummary,
} from '@knowguard/types';
import type { Metadata } from 'next';

import { ActionForm } from '@/components/admin/action-form';
import { timeAgo } from '@/components/documents/document-labels';
import { AccessDenied, PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { apiRequest } from '@/lib/api';
import { can } from '@/lib/permissions';
import { getSessionToken, requireUser } from '@/lib/session';
import { cn, initials } from '@/lib/utils';

import {
  inviteMemberAction,
  reactivateMemberAction,
  reissueInvitationAction,
  setMemberRoleAction,
  suspendMemberAction,
} from '../actions';

export const metadata: Metadata = { title: 'Users' };

const STATUS_VARIANT: Record<MemberStatus, 'success' | 'secondary' | 'destructive' | 'outline'> = {
  ACTIVE: 'success',
  INVITED: 'secondary',
  SUSPENDED: 'destructive',
  DEACTIVATED: 'outline',
};

const dateFormat = new Intl.DateTimeFormat('en', { dateStyle: 'medium' });

export default async function UsersPage() {
  const me = await requireUser();
  if (!can(me, 'user.read')) return <AccessDenied what="user management" />;

  const token = await getSessionToken();
  const [{ members }, roles] = await Promise.all([
    apiRequest<MemberListResponse>('/users', { token }),
    can(me, 'role.read')
      ? apiRequest<RoleListResponse>('/roles', { token }).then((res) => res.roles)
      : Promise.resolve([] as RoleSummary[]),
  ]);
  const assignable = roles.filter((role) => role.assignable);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Users"
        description={`${members.length} member${members.length === 1 ? '' : 's'} in ${me.organization.name}.`}
      />

      {can(me, 'user.create') && assignable.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Invite a member</CardTitle>
            <CardDescription>
              Creates a one-time link (valid 7 days). Share it with the person; they choose their own
              password.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ActionForm action={inviteMemberAction} submitLabel="Create invitation" inline>
              <div className="flex min-w-40 flex-1 flex-col gap-1.5">
                <Label htmlFor="invite-name">Name</Label>
                <Input id="invite-name" name="name" required autoComplete="off" />
              </div>
              <div className="flex min-w-52 flex-1 flex-col gap-1.5">
                <Label htmlFor="invite-email">Email</Label>
                <Input id="invite-email" name="email" type="email" required autoComplete="off" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="invite-role">Role</Label>
                <Select id="invite-role" name="roleKey" defaultValue="EMPLOYEE">
                  {assignable.map((role) => (
                    <option key={role.key} value={role.key}>
                      {role.name}
                    </option>
                  ))}
                </Select>
              </div>
            </ActionForm>
          </CardContent>
        </Card>
      ) : null}

      <Card className="py-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="members-table">
            <thead className="border-b bg-muted/60 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Member</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium">Role</th>
                <th className="px-3 py-3 font-medium">Groups</th>
                <th className="px-3 py-3 font-medium">Last sign-in</th>
                <th className="px-5 py-3 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {members.map((member) => (
                <MemberRow
                  key={member.id}
                  member={member}
                  isSelf={member.id === me.user.id}
                  roles={assignable}
                  canChangeRole={can(me, 'role.update')}
                  canChangeStatus={can(me, 'user.update')}
                  canInvite={can(me, 'user.create')}
                />
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function MemberRow({
  member,
  isSelf,
  roles,
  canChangeRole,
  canChangeStatus,
  canInvite,
}: {
  member: MemberSummary;
  isSelf: boolean;
  roles: RoleSummary[];
  canChangeRole: boolean;
  canChangeStatus: boolean;
  canInvite: boolean;
}) {
  const hidden = { userId: member.id };
  const groups = [...member.departments, ...member.teams].map((group) => group.name);
  return (
    <tr data-testid={`member-${member.email}`} className="align-middle transition-colors hover:bg-accent/40">
      <td className="px-5 py-3">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
              isSelf ? 'bg-ink text-white' : 'bg-muted text-foreground',
            )}
          >
            {initials(member.name)}
          </span>
          <div className="min-w-0">
            <p className="font-medium">
              {member.name}{' '}
              {isSelf ? <span className="text-xs font-normal text-muted-foreground">(you)</span> : null}
            </p>
            <p className="truncate text-xs text-muted-foreground">{member.email}</p>
          </div>
        </div>
      </td>
      <td className="px-3 py-3">
        <Badge variant={STATUS_VARIANT[member.status]} data-testid="member-status">
          {member.status.toLowerCase()}
        </Badge>
      </td>
      <td className="px-3 py-3">
        {member.manageable && canChangeRole && roles.length > 0 ? (
          <ActionForm
            action={setMemberRoleAction}
            hidden={hidden}
            submitLabel="Save"
            variant="outline"
            inline
            quiet
          >
            <Select name="roleKey" aria-label={`Role for ${member.name}`} defaultValue={member.roles[0]}>
              {roles.map((role) => (
                <option key={role.key} value={role.key}>
                  {role.name}
                </option>
              ))}
            </Select>
          </ActionForm>
        ) : (
          <span data-testid="member-roles">{member.roles.join(', ') || '—'}</span>
        )}
      </td>
      <td className="px-3 py-3 text-xs text-muted-foreground">{groups.join(', ') || '—'}</td>
      <td
        className="px-3 py-3 text-xs whitespace-nowrap text-muted-foreground"
        title={member.lastLoginAt ? dateFormat.format(new Date(member.lastLoginAt)) : undefined}
      >
        {member.lastLoginAt ? timeAgo(member.lastLoginAt) : 'Never'}
      </td>
      <td className="px-5 py-3">
        {member.manageable ? (
          <div className="flex flex-col items-end gap-2">
            {member.status === 'INVITED' && canInvite ? (
              <ActionForm
                action={reissueInvitationAction}
                hidden={hidden}
                submitLabel="New link"
                variant="outline"
              />
            ) : null}
            {canChangeStatus && member.status === 'SUSPENDED' ? (
              <ActionForm
                action={reactivateMemberAction}
                hidden={hidden}
                submitLabel="Reactivate"
                variant="outline"
              />
            ) : null}
            {canChangeStatus && (member.status === 'ACTIVE' || member.status === 'INVITED') ? (
              <ActionForm
                action={suspendMemberAction}
                hidden={hidden}
                submitLabel="Suspend"
                variant="ghost"
              />
            ) : null}
          </div>
        ) : null}
      </td>
    </tr>
  );
}

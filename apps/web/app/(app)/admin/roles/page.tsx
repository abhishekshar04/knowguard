import type { PermissionListResponse, RoleListResponse, RoleSummary } from '@knowguard/types';
import type { Metadata } from 'next';

import { ActionForm } from '@/components/admin/action-form';
import { PermissionPicker } from '@/components/admin/permission-picker';
import { AccessDenied, PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiRequest } from '@/lib/api';
import { can } from '@/lib/permissions';
import { getSessionToken, requireUser } from '@/lib/session';

import { createRoleAction, deleteRoleAction, updateRoleAction } from '../actions';

export const metadata: Metadata = { title: 'Roles' };

export default async function RolesPage() {
  const me = await requireUser();
  if (!can(me, 'role.read')) return <AccessDenied what="roles" />;

  const token = await getSessionToken();
  const [{ roles }, { permissions: catalog }] = await Promise.all([
    apiRequest<RoleListResponse>('/roles', { token }),
    apiRequest<PermissionListResponse>('/permissions', { token }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Roles"
        description="Roles bundle permissions. Built-in roles are fixed; custom roles can hold any permissions you hold yourself."
      />

      {can(me, 'role.create') ? (
        <Card>
          <CardHeader>
            <CardTitle>New custom role</CardTitle>
          </CardHeader>
          <CardContent>
            <ActionForm action={createRoleAction} submitLabel="Create role">
              <RoleFields idPrefix="new-role" />
              <PermissionPicker catalog={catalog} grantable={me.permissions} idPrefix="new-role" />
            </ActionForm>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-col gap-4">
        {roles.map((role) => (
          <RoleCard
            key={role.id}
            role={role}
            catalog={catalog}
            grantable={me.permissions}
            canUpdate={can(me, 'role.update')}
            canDelete={can(me, 'role.delete')}
          />
        ))}
      </div>
    </div>
  );
}

function RoleFields({ idPrefix, role }: { idPrefix: string; role?: RoleSummary }) {
  return (
    <div className="flex flex-wrap gap-3">
      <div className="flex min-w-48 flex-1 flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-name`}>Role name</Label>
        <Input id={`${idPrefix}-name`} name="name" defaultValue={role?.name} required />
      </div>
      <div className="flex min-w-60 flex-[2] flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-description`}>Description (optional)</Label>
        <Input id={`${idPrefix}-description`} name="description" defaultValue={role?.description ?? ''} />
      </div>
    </div>
  );
}

function RoleCard({
  role,
  catalog,
  grantable,
  canUpdate,
  canDelete,
}: {
  role: RoleSummary;
  catalog: PermissionListResponse['permissions'];
  grantable: readonly string[];
  canUpdate: boolean;
  canDelete: boolean;
}) {
  const hidden = { roleId: role.id };
  return (
    <Card data-testid={`role-${role.key}`}>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {role.name}
          <Badge variant={role.isSystem ? 'secondary' : 'outline'}>
            {role.isSystem ? 'built-in' : 'custom'}
          </Badge>
          <span className="font-mono text-xs font-normal text-muted-foreground">{role.key}</span>
        </CardTitle>
        <CardDescription>
          {role.description ? `${role.description} · ` : ''}
          {role.memberCount} member{role.memberCount === 1 ? '' : 's'} · {role.permissions.length} permission
          {role.permissions.length === 1 ? '' : 's'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {role.editable && canUpdate ? (
          <details>
            <summary className="cursor-pointer text-sm font-medium">Edit role</summary>
            <div className="mt-4 flex flex-col gap-4">
              <ActionForm action={updateRoleAction} hidden={hidden} submitLabel="Save role">
                <RoleFields idPrefix={`edit-${role.id}`} role={role} />
                <PermissionPicker
                  catalog={catalog}
                  grantable={grantable}
                  selected={role.permissions}
                  idPrefix={`edit-${role.id}`}
                />
              </ActionForm>
              {canDelete ? (
                <ActionForm
                  action={deleteRoleAction}
                  hidden={hidden}
                  submitLabel={`Delete ${role.name}`}
                  variant="ghost"
                />
              ) : null}
            </div>
          </details>
        ) : (
          <div className="flex flex-wrap gap-1">
            {role.permissions.map((permission) => (
              <Badge key={permission} variant="outline" className="font-mono">
                {permission}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

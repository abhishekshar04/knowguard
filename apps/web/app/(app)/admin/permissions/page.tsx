import type { PermissionListResponse, RoleListResponse } from '@knowguard/types';
import { Check } from 'lucide-react';
import type { Metadata } from 'next';

import { AccessDenied, PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { apiRequest } from '@/lib/api';
import { can } from '@/lib/permissions';
import { getSessionToken, requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Permissions' };

/** Read-only matrix of which role grants which capability. Edit roles on the Roles page. */
export default async function PermissionsPage() {
  const me = await requireUser();
  if (!can(me, 'role.read')) return <AccessDenied what="permissions" />;

  const token = await getSessionToken();
  const [{ roles }, { permissions }] = await Promise.all([
    apiRequest<RoleListResponse>('/roles', { token }),
    apiRequest<PermissionListResponse>('/permissions', { token }),
  ]);
  const grants = new Map(roles.map((role) => [role.id, new Set(role.permissions)]));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Permissions"
        description="Role permissions are capabilities, not access to specific documents: document access also depends on each document's visibility and sharing."
      />
      <Card className="py-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="permission-matrix">
            <thead className="border-b text-xs text-muted-foreground">
              <tr>
                <th className="px-5 py-3 text-left font-medium uppercase tracking-wide">Permission</th>
                {roles.map((role) => (
                  <th key={role.id} scope="col" className="px-3 py-3 text-center font-medium">
                    {role.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {permissions.map((permission) => (
                <tr key={permission.key}>
                  <th scope="row" className="px-5 py-2 text-left font-normal">
                    <span className="font-mono text-xs">{permission.key}</span>
                    <span className="block text-xs text-muted-foreground">{permission.description}</span>
                  </th>
                  {roles.map((role) => {
                    const granted = grants.get(role.id)?.has(permission.key) ?? false;
                    return (
                      <td key={role.id} className="px-3 py-2 text-center">
                        {granted ? (
                          <Check className="mx-auto size-4 text-success" aria-label="granted" />
                        ) : (
                          <span className="text-muted-foreground/40" aria-label="not granted">
                            ·
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

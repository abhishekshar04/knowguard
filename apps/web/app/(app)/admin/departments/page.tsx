import type { DepartmentListResponse, MemberListResponse, MemberSummary } from '@knowguard/types';
import type { Metadata } from 'next';

import { ActionForm } from '@/components/admin/action-form';
import { GroupCard } from '@/components/admin/group-card';
import { AccessDenied, PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiRequest } from '@/lib/api';
import { can } from '@/lib/permissions';
import { getSessionToken, requireUser } from '@/lib/session';

import {
  addDepartmentMemberAction,
  createDepartmentAction,
  deleteDepartmentAction,
  removeDepartmentMemberAction,
  renameDepartmentAction,
} from '../actions';

export const metadata: Metadata = { title: 'Departments' };

export default async function DepartmentsPage() {
  const me = await requireUser();
  if (!can(me, 'organization.read')) return <AccessDenied what="departments" />;
  const manage = can(me, 'department.manage');

  const token = await getSessionToken();
  const [{ departments }, directory] = await Promise.all([
    apiRequest<DepartmentListResponse>('/departments', { token }),
    manage && can(me, 'user.read')
      ? apiRequest<MemberListResponse>('/users', { token }).then((res) => res.members)
      : Promise.resolve([] as MemberSummary[]),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Departments"
        description="Top-level groups in your organization. Teams live inside departments."
      />

      {manage ? (
        <Card>
          <CardHeader>
            <CardTitle>New department</CardTitle>
          </CardHeader>
          <CardContent>
            <ActionForm action={createDepartmentAction} submitLabel="Create department" inline>
              <div className="flex min-w-48 flex-1 flex-col gap-1.5">
                <Label htmlFor="department-name">Name</Label>
                <Input id="department-name" name="name" required />
              </div>
              <div className="flex min-w-48 flex-[2] flex-col gap-1.5">
                <Label htmlFor="department-description">Description (optional)</Label>
                <Input id="department-description" name="description" />
              </div>
            </ActionForm>
          </CardContent>
        </Card>
      ) : null}

      {departments.length === 0 ? <p className="text-sm text-muted-foreground">No departments yet.</p> : null}
      <div className="grid gap-4 md:grid-cols-2">
        {departments.map((department) => (
          <GroupCard
            key={department.id}
            testId={`department-${department.name}`}
            idField={{ departmentId: department.id }}
            name={department.name}
            subtitle={
              [
                department.description,
                department.teams.length ? `Teams: ${department.teams.map((t) => t.name).join(', ')}` : null,
              ]
                .filter(Boolean)
                .join(' · ') || undefined
            }
            members={department.members}
            directory={directory}
            manage={manage}
            actions={{
              rename: renameDepartmentAction,
              remove: deleteDepartmentAction,
              addMember: addDepartmentMemberAction,
              removeMember: removeDepartmentMemberAction,
            }}
          />
        ))}
      </div>
    </div>
  );
}

import type {
  DepartmentListResponse,
  MemberListResponse,
  MemberSummary,
  TeamListResponse,
} from '@knowguard/types';
import type { Metadata } from 'next';
import Link from 'next/link';

import { ActionForm } from '@/components/admin/action-form';
import { GroupCard } from '@/components/admin/group-card';
import { UsersRound } from 'lucide-react';
import { AccessDenied, EmptyState, PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { apiRequest } from '@/lib/api';
import { can } from '@/lib/permissions';
import { getSessionToken, requireUser } from '@/lib/session';

import {
  addTeamMemberAction,
  createTeamAction,
  deleteTeamAction,
  removeTeamMemberAction,
  renameTeamAction,
} from '../actions';

export const metadata: Metadata = { title: 'Manage teams' };

export default async function AdminTeamsPage() {
  const me = await requireUser();
  if (!can(me, 'organization.read')) return <AccessDenied what="teams" />;
  const manage = can(me, 'team.manage');

  const token = await getSessionToken();
  const [{ teams }, { departments }, directory] = await Promise.all([
    apiRequest<TeamListResponse>('/teams', { token }),
    apiRequest<DepartmentListResponse>('/departments', { token }),
    manage && can(me, 'user.read')
      ? apiRequest<MemberListResponse>('/users', { token }).then((res) => res.members)
      : Promise.resolve([] as MemberSummary[]),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Teams" description="Working groups inside departments." />

      {manage ? (
        <Card>
          <CardHeader>
            <CardTitle>New team</CardTitle>
          </CardHeader>
          <CardContent>
            {departments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Create a{' '}
                <Link href="/admin/departments" className="underline">
                  department
                </Link>{' '}
                first — every team belongs to one.
              </p>
            ) : (
              <ActionForm action={createTeamAction} submitLabel="Create team" inline>
                <div className="flex min-w-48 flex-1 flex-col gap-1.5">
                  <Label htmlFor="team-name">Name</Label>
                  <Input id="team-name" name="name" required />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="team-department">Department</Label>
                  <Select id="team-department" name="departmentId">
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </ActionForm>
            )}
          </CardContent>
        </Card>
      ) : null}

      {teams.length === 0 ? (
        <EmptyState icon={UsersRound} title="No teams yet">
          Teams are working groups inside a department. Documents can be shared with a team.
        </EmptyState>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        {teams.map((team) => (
          <GroupCard
            key={team.id}
            testId={`team-${team.name}`}
            idField={{ teamId: team.id }}
            name={team.name}
            subtitle={team.department.name}
            members={team.members}
            directory={directory}
            manage={manage}
            actions={{
              rename: renameTeamAction,
              remove: deleteTeamAction,
              addMember: addTeamMemberAction,
              removeMember: removeTeamMemberAction,
            }}
          />
        ))}
      </div>
    </div>
  );
}

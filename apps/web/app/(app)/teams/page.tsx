import type { TeamDetails, TeamListResponse } from '@knowguard/types';
import { UsersRound } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { AccessDenied, EmptyState, PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiRequest } from '@/lib/api';
import { can } from '@/lib/permissions';
import { getSessionToken, requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Teams' };

function TeamCard({ team }: { team: TeamDetails }) {
  return (
    <Card data-testid={`my-team-${team.name}`}>
      <CardHeader>
        <CardTitle>{team.name}</CardTitle>
        <CardDescription>{team.department.name}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-1 text-sm">
          {team.members.map((member) => (
            <li key={member.id}>
              {member.name} <span className="text-xs text-muted-foreground">{member.email}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export default async function TeamsPage() {
  const me = await requireUser();
  if (!can(me, 'organization.read')) return <AccessDenied what="teams" />;

  const { teams } = await apiRequest<TeamListResponse>('/teams', { token: await getSessionToken() });
  const mine = teams.filter((team) => team.members.some((member) => member.id === me.user.id));
  const others = teams.filter((team) => !mine.includes(team));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Teams"
        description="Team membership will decide which team-restricted documents you can read."
        actions={
          can(me, 'team.manage') ? (
            <Button asChild variant="outline">
              <Link href="/admin/teams">Manage teams</Link>
            </Button>
          ) : null
        }
      />

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-semibold tracking-tight">Your teams</h2>
        {mine.length === 0 ? (
          <EmptyState icon={UsersRound} title="You are not in any team yet">
            <span data-testid="no-teams">
              An administrator can add you to a team. Team documents become readable once you join.
            </span>
          </EmptyState>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {mine.map((team) => (
              <TeamCard key={team.id} team={team} />
            ))}
          </div>
        )}
      </section>

      {others.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-semibold tracking-tight">Other teams</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {others.map((team) => (
              <TeamCard key={team.id} team={team} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

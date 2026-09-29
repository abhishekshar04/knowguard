import type { TeamDetails, TeamListResponse } from '@knowguard/types';
import type { Metadata } from 'next';
import Link from 'next/link';

import { AccessDenied, PageHeader } from '@/components/page-header';
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
            <Link href="/admin/teams" className="text-sm font-medium underline-offset-4 hover:underline">
              Manage teams
            </Link>
          ) : null
        }
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Your teams</h2>
        {mine.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="no-teams">
            You are not in any team yet.
          </p>
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
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Other teams</h2>
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

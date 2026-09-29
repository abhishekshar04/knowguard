import type { MemberRef, MemberSummary } from '@knowguard/types';
import type { ReactNode } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { ActionResult } from '@/lib/action-result';

import { ActionForm } from './action-form';

type Action = (prev: ActionResult, form: FormData) => Promise<ActionResult>;

interface GroupCardProps {
  /** Hidden ID field identifying the group, e.g. { departmentId }. */
  idField: Record<string, string>;
  name: string;
  subtitle?: ReactNode;
  members: MemberRef[];
  /** Organization members, to offer for adding. */
  directory: MemberSummary[];
  manage: boolean;
  actions: { rename: Action; remove: Action; addMember: Action; removeMember: Action };
  testId: string;
}

/** Shared card for a department or team: rename, delete, and membership management. */
export function GroupCard({
  idField,
  name,
  subtitle,
  members,
  directory,
  manage,
  actions,
  testId,
}: GroupCardProps) {
  const memberIds = new Set(members.map((member) => member.id));
  const candidates = directory.filter((member) => !memberIds.has(member.id) && member.status !== 'SUSPENDED');

  return (
    <Card data-testid={testId}>
      <CardHeader>
        <CardTitle>{name}</CardTitle>
        {subtitle ? <CardDescription>{subtitle}</CardDescription> : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Members ({members.length})
          </p>
          {members.length === 0 ? <p className="text-sm text-muted-foreground">No members yet.</p> : null}
          <ul className="flex flex-col gap-1">
            {members.map((member) => (
              <li key={member.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate">
                  {member.name} <span className="text-xs text-muted-foreground">{member.email}</span>
                </span>
                {manage ? (
                  <ActionForm
                    action={actions.removeMember}
                    hidden={{ ...idField, userId: member.id }}
                    submitLabel="Remove"
                    variant="ghost"
                    quiet
                  />
                ) : null}
              </li>
            ))}
          </ul>
        </div>

        {manage ? (
          <div className="flex flex-col gap-3 border-t pt-3">
            {candidates.length > 0 ? (
              <ActionForm
                action={actions.addMember}
                hidden={idField}
                submitLabel="Add"
                variant="outline"
                inline
                quiet
              >
                <Select name="userId" aria-label={`Add member to ${name}`} className="min-w-0 flex-1">
                  {candidates.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name} ({member.email})
                    </option>
                  ))}
                </Select>
              </ActionForm>
            ) : null}
            <ActionForm
              action={actions.rename}
              hidden={idField}
              submitLabel="Rename"
              variant="outline"
              inline
              quiet
            >
              <Input
                name="name"
                defaultValue={name}
                aria-label={`New name for ${name}`}
                className="min-w-0 flex-1"
              />
            </ActionForm>
            <ActionForm
              action={actions.remove}
              hidden={idField}
              submitLabel={`Delete ${name}`}
              variant="ghost"
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

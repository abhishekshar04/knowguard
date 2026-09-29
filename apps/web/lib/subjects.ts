import 'server-only';

import type {
  DepartmentListResponse,
  MeResponse,
  MemberListResponse,
  RoleListResponse,
  SubjectRef,
  TeamListResponse,
} from '@knowguard/types';

import { apiRequest } from './api';
import { can } from './permissions';

export interface SubjectOptions {
  users: SubjectRef[];
  roles: SubjectRef[];
  teams: SubjectRef[];
  departments: SubjectRef[];
}

/**
 * Who a document can be shared with, limited to what the caller may list. (The API validates
 * every subject again, so a stale or forged option is simply rejected.)
 */
export async function loadSubjectOptions(me: MeResponse, token: string): Promise<SubjectOptions> {
  const [members, roles, teams, departments] = await Promise.all([
    can(me, 'user.read') ? apiRequest<MemberListResponse>('/users', { token }).then((r) => r.members) : [],
    can(me, 'role.read') ? apiRequest<RoleListResponse>('/roles', { token }).then((r) => r.roles) : [],
    apiRequest<TeamListResponse>('/teams', { token }).then((r) => r.teams),
    apiRequest<DepartmentListResponse>('/departments', { token }).then((r) => r.departments),
  ]);
  return {
    users: members
      .filter((m) => m.status === 'ACTIVE' || m.status === 'INVITED')
      .map((m) => ({ type: 'USER', id: m.id, name: `${m.name} (${m.email})` })),
    roles: roles.map((r) => ({ type: 'ROLE', id: r.id, name: r.name })),
    teams: teams.map((t) => ({ type: 'TEAM', id: t.id, name: `${t.name} · ${t.department.name}` })),
    departments: departments.map((d) => ({ type: 'DEPARTMENT', id: d.id, name: d.name })),
  };
}

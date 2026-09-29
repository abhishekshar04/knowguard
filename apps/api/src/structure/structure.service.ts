import { HttpStatus, Injectable } from '@nestjs/common';
import type { Prisma } from '@knowguard/database';
import type { DepartmentDetails, MemberRef, TeamDetails } from '@knowguard/types';
import type {
  CreateDepartmentInput,
  CreateTeamInput,
  UpdateDepartmentInput,
  UpdateTeamInput,
} from '@knowguard/validation';

import { ApiException, notFound } from '../common/api-exception';
import { isUniqueViolation } from '../common/prisma-errors';
import { PrismaService } from '../common/prisma.service';

const memberRefSelect = {
  membership: { select: { user: { select: { id: true, name: true, email: true } } } },
} as const;

const departmentSelect = {
  id: true,
  name: true,
  description: true,
  teams: { select: { id: true, name: true }, orderBy: { name: 'asc' } },
  members: { select: memberRefSelect },
} satisfies Prisma.DepartmentSelect;

const teamSelect = {
  id: true,
  name: true,
  description: true,
  department: { select: { id: true, name: true } },
  members: { select: memberRefSelect },
} satisfies Prisma.TeamSelect;

type MemberLinks = ReadonlyArray<{ membership: { user: MemberRef } }>;
const toMemberRefs = (links: MemberLinks): MemberRef[] =>
  links.map((link) => link.membership.user).sort((a, b) => a.name.localeCompare(b.name));

const nameTaken = (what: 'department' | 'team'): ApiException =>
  new ApiException(
    'NAME_TAKEN',
    what === 'department'
      ? 'A department with this name already exists.'
      : 'A team with this name already exists in that department.',
    HttpStatus.CONFLICT,
  );

/**
 * Departments, teams and their memberships. Every lookup is filtered by the caller's
 * organization, and composite foreign keys make cross-tenant links impossible even if a
 * filter were missed.
 */
@Injectable()
export class StructureService {
  constructor(private readonly prisma: PrismaService) {}

  // ── departments ──────────────────────────────────────────────────────────────────────

  async listDepartments(organizationId: string): Promise<DepartmentDetails[]> {
    const rows = await this.prisma.department.findMany({
      where: { organizationId },
      select: departmentSelect,
      orderBy: { name: 'asc' },
    });
    return rows.map((row) => ({ ...row, members: toMemberRefs(row.members) }));
  }

  async createDepartment(organizationId: string, input: CreateDepartmentInput): Promise<DepartmentDetails> {
    try {
      const row = await this.prisma.department.create({
        data: { organizationId, name: input.name, description: input.description ?? null },
        select: departmentSelect,
      });
      return { ...row, members: toMemberRefs(row.members) };
    } catch (error) {
      if (isUniqueViolation(error)) throw nameTaken('department');
      throw error;
    }
  }

  async updateDepartment(
    organizationId: string,
    id: string,
    input: UpdateDepartmentInput,
  ): Promise<DepartmentDetails> {
    await this.findDepartment(organizationId, id);
    try {
      const row = await this.prisma.department.update({
        where: { id_organizationId: { id, organizationId } },
        data: input,
        select: departmentSelect,
      });
      return { ...row, members: toMemberRefs(row.members) };
    } catch (error) {
      if (isUniqueViolation(error)) throw nameTaken('department');
      throw error;
    }
  }

  /** Refuses while the department still has teams, so deleting never silently drops teams. */
  async deleteDepartment(organizationId: string, id: string): Promise<void> {
    await this.findDepartment(organizationId, id);
    const teams = await this.prisma.team.count({ where: { organizationId, departmentId: id } });
    if (teams > 0) {
      throw new ApiException(
        'DEPARTMENT_NOT_EMPTY',
        'Move or delete the teams in this department first.',
        HttpStatus.CONFLICT,
      );
    }
    await this.prisma.department.delete({ where: { id_organizationId: { id, organizationId } } });
  }

  async addDepartmentMember(organizationId: string, departmentId: string, userId: string): Promise<void> {
    await this.findDepartment(organizationId, departmentId);
    await this.findMember(organizationId, userId);
    await this.prisma.departmentMembership.createMany({
      data: [{ organizationId, departmentId, userId }],
      skipDuplicates: true,
    });
  }

  async removeDepartmentMember(organizationId: string, departmentId: string, userId: string): Promise<void> {
    await this.findDepartment(organizationId, departmentId);
    await this.prisma.departmentMembership.deleteMany({ where: { organizationId, departmentId, userId } });
  }

  // ── teams ────────────────────────────────────────────────────────────────────────────

  async listTeams(organizationId: string): Promise<TeamDetails[]> {
    const rows = await this.prisma.team.findMany({
      where: { organizationId },
      select: teamSelect,
      orderBy: [{ department: { name: 'asc' } }, { name: 'asc' }],
    });
    return rows.map((row) => ({ ...row, members: toMemberRefs(row.members) }));
  }

  async createTeam(organizationId: string, input: CreateTeamInput): Promise<TeamDetails> {
    await this.findDepartment(organizationId, input.departmentId);
    try {
      const row = await this.prisma.team.create({
        data: {
          organizationId,
          departmentId: input.departmentId,
          name: input.name,
          description: input.description ?? null,
        },
        select: teamSelect,
      });
      return { ...row, members: toMemberRefs(row.members) };
    } catch (error) {
      if (isUniqueViolation(error)) throw nameTaken('team');
      throw error;
    }
  }

  async updateTeam(organizationId: string, id: string, input: UpdateTeamInput): Promise<TeamDetails> {
    await this.findTeam(organizationId, id);
    if (input.departmentId) await this.findDepartment(organizationId, input.departmentId);
    try {
      const row = await this.prisma.team.update({
        where: { id_organizationId: { id, organizationId } },
        data: input,
        select: teamSelect,
      });
      return { ...row, members: toMemberRefs(row.members) };
    } catch (error) {
      if (isUniqueViolation(error)) throw nameTaken('team');
      throw error;
    }
  }

  async deleteTeam(organizationId: string, id: string): Promise<void> {
    await this.findTeam(organizationId, id);
    await this.prisma.team.delete({ where: { id_organizationId: { id, organizationId } } });
  }

  async addTeamMember(organizationId: string, teamId: string, userId: string): Promise<void> {
    await this.findTeam(organizationId, teamId);
    await this.findMember(organizationId, userId);
    await this.prisma.teamMembership.createMany({
      data: [{ organizationId, teamId, userId }],
      skipDuplicates: true,
    });
  }

  async removeTeamMember(organizationId: string, teamId: string, userId: string): Promise<void> {
    await this.findTeam(organizationId, teamId);
    await this.prisma.teamMembership.deleteMany({ where: { organizationId, teamId, userId } });
  }

  // ── tenant-scoped lookups ────────────────────────────────────────────────────────────

  private async findDepartment(organizationId: string, id: string): Promise<void> {
    const found = await this.prisma.department.findUnique({
      where: { id_organizationId: { id, organizationId } },
      select: { id: true },
    });
    if (!found) throw notFound('department');
  }

  private async findTeam(organizationId: string, id: string): Promise<void> {
    const found = await this.prisma.team.findUnique({
      where: { id_organizationId: { id, organizationId } },
      select: { id: true },
    });
    if (!found) throw notFound('team');
  }

  private async findMember(organizationId: string, userId: string): Promise<void> {
    const found = await this.prisma.userOrganization.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
      select: { userId: true },
    });
    if (!found) throw notFound('member');
  }
}

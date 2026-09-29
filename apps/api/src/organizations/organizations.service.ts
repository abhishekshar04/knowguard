import { Injectable } from '@nestjs/common';
import { type Prisma, provisionSystemRoles } from '@knowguard/database';

import { PrismaService } from '../common/prisma.service';
import { randomSuffix, slugCandidates } from './slug';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** First candidate slug not currently taken. A concurrent race is caught by the unique index. */
  async pickAvailableSlug(name: string): Promise<string> {
    const candidates = slugCandidates(name);
    const taken = await this.prisma.organization.findMany({
      where: { slug: { in: candidates } },
      select: { slug: true },
    });
    const takenSet = new Set(taken.map((row) => row.slug));
    return candidates.find((slug) => !takenSet.has(slug)) ?? `${candidates[0]}-${randomSuffix()}`;
  }

  /**
   * Creates an organization, its system roles, and an ACTIVE OWNER membership for `ownerId`,
   * inside the caller's transaction — a tenant never exists without roles and an owner.
   */
  async createWithOwner(
    tx: Prisma.TransactionClient,
    input: { name: string; slug: string; ownerId: string },
  ): Promise<{ id: string; slug: string }> {
    const organization = await tx.organization.create({
      data: { name: input.name, slug: input.slug },
      select: { id: true, slug: true },
    });
    const roleIds = await provisionSystemRoles(tx, organization.id);
    await tx.userOrganization.create({
      data: { userId: input.ownerId, organizationId: organization.id, status: 'ACTIVE' },
    });
    await tx.userRole.create({
      data: { userId: input.ownerId, organizationId: organization.id, roleId: roleIds.OWNER },
    });
    return organization;
  }
}

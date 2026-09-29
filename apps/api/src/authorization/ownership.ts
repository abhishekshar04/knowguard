import { HttpStatus } from '@nestjs/common';
import type { Prisma } from '@knowguard/database';

import { ApiException } from '../common/api-exception';
import { OWNERSHIP_PERMISSION } from './management-policy';

/**
 * Invariant: an organization always keeps at least one ACTIVE member (with an ACTIVE account)
 * who holds the ownership permission. Call at the end of any transaction that changes roles,
 * role permissions or membership status; throwing rolls the whole change back.
 */
export async function assertOwnershipRemains(
  tx: Prisma.TransactionClient,
  organizationId: string,
): Promise<void> {
  const owners = await tx.userOrganization.count({
    where: {
      organizationId,
      status: 'ACTIVE',
      user: { status: 'ACTIVE' },
      roles: { some: { role: { permissions: { some: { permission: { key: OWNERSHIP_PERMISSION } } } } } },
    },
  });
  if (owners === 0) {
    throw new ApiException(
      'LAST_OWNER',
      'The organization must keep at least one active owner.',
      HttpStatus.CONFLICT,
    );
  }
}

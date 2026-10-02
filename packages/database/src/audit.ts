import type { Prisma, PrismaClient } from '@prisma/client';

/**
 * The only sanctioned way to delete audit records (retention, test cleanup, removing an
 * organization). audit_logs is append-only: a trigger rejects DELETE unless the transaction
 * sets knowguard.audit_purge, which this helper does for its own transaction only.
 */
export async function purgeAuditLogs(
  client: PrismaClient,
  where: Prisma.AuditLogWhereInput,
): Promise<number> {
  return client.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('knowguard.audit_purge', 'on', true)`;
    const { count } = await tx.auditLog.deleteMany({ where });
    return count;
  });
}

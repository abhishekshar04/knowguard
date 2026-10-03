import { Injectable, Logger } from '@nestjs/common';
import type { $Enums } from '@knowguard/database';
import type { AuditActionValue, AuditResourceTypeValue, AuditResultValue } from '@knowguard/types';

import type { AuthContext } from '../auth/auth-context';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';
import { currentRequestMeta } from '../common/request-context';
import { sanitizeAuditMetadata } from './audit-metadata';

// The browser-safe value lists in @knowguard/types must match the database enums exactly.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const enumsMatch: [
  Same<AuditActionValue, $Enums.AuditAction>,
  Same<AuditResultValue, $Enums.AuditResult>,
  Same<AuditResourceTypeValue, $Enums.AuditResourceType>,
] = [true, true, true];
void enumsMatch;

export interface AuditEvent {
  /** Who acted, in which organization. `userId: null` for system actions. */
  actor: { userId: string | null; organizationId: string };
  action: AuditActionValue;
  resourceType: AuditResourceTypeValue;
  resourceId?: string | null;
  result?: AuditResultValue;
  /** Small, non-sensitive details; sanitized again before storage. */
  metadata?: Record<string, unknown>;
}

/** Repeated views of the same document by the same user within this window are one event. */
const VIEW_DEDUP_SECONDS = 5 * 60;

export const actorOf = (auth: Pick<AuthContext, 'userId' | 'organizationId'>) => ({
  userId: auth.userId,
  organizationId: auth.organizationId,
});

/**
 * Writes the append-only audit log (spec §28, ADR 0012).
 *
 * Recording happens after the audited operation succeeds (or is refused) and never fails the
 * request: a failed write is logged as an error for operators instead. IP and user agent are
 * taken from the current HTTP request.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async record(event: AuditEvent): Promise<void> {
    const meta = currentRequestMeta();
    try {
      await this.prisma.auditLog.create({
        data: {
          organizationId: event.actor.organizationId,
          userId: event.actor.userId,
          action: event.action,
          resourceType: event.resourceType,
          resourceId: event.resourceId ?? null,
          result: event.result ?? 'SUCCESS',
          metadata: sanitizeAuditMetadata(event.metadata) as object,
          ip: meta?.ip.slice(0, 64) ?? null,
          userAgent: meta?.userAgent ?? null,
        },
      });
    } catch (error) {
      this.logger.error(
        `Audit write failed (${event.action} ${event.resourceType}:${event.resourceId ?? '-'}): ${(error as Error).message}`,
      );
    }
  }

  /** For paths whose response time must not depend on auditing (e.g. failed logins). */
  recordInBackground(event: AuditEvent): void {
    void this.record(event);
  }

  /** DOCUMENT_VIEW, collapsed per user and document within a short window. */
  async recordView(auth: AuthContext, documentId: string, metadata?: Record<string, unknown>): Promise<void> {
    let first = true;
    try {
      const key = `kg:audit:view:${auth.userId}:${documentId}`;
      first = (await this.redis.client.set(key, '1', 'EX', VIEW_DEDUP_SECONDS, 'NX')) === 'OK';
    } catch {
      // Without Redis, record every view rather than none.
    }
    if (first) {
      await this.record({
        actor: actorOf(auth),
        action: 'DOCUMENT_VIEW',
        resourceType: 'DOCUMENT',
        resourceId: documentId,
        ...(metadata ? { metadata } : {}),
      });
    }
  }
}

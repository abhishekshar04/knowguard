import {
  type CallHandler,
  type ExecutionContext,
  HttpStatus,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { catchError, type Observable, throwError } from 'rxjs';

import type { AuthenticatedRequest } from '../auth/auth-context';
import { ApiException } from '../common/api-exception';
import { actorOf, AuditService } from './audit.service';

/** Errors already recorded with resource details where they were raised. */
const recorded = new WeakSet<object>();

export function markAudited<T extends object>(error: T): T {
  recorded.add(error);
  return error;
}

/**
 * Records every 403 raised by a handler (management and escalation rules, document actions)
 * as ACCESS_DENIED, unless the code that refused it already recorded a more specific entry.
 * Capability failures in the global guard are recorded by the guard itself.
 */
@Injectable()
export class AccessDeniedInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      catchError((error: unknown) => {
        const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
        const auth = request.auth;
        if (
          error instanceof ApiException &&
          error.getStatus() === HttpStatus.FORBIDDEN &&
          !recorded.has(error) &&
          auth
        ) {
          return new Promise<never>((_, reject) => {
            void this.audit
              .record({
                actor: actorOf(auth),
                action: 'ACCESS_DENIED',
                resourceType: 'ENDPOINT',
                result: 'DENIED',
                metadata: endpointMetadata(request, error.code),
              })
              .finally(() => reject(error));
          });
        }
        return throwError(() => error);
      }),
    );
  }
}

export function endpointMetadata(
  request: Pick<AuthenticatedRequest, 'method' | 'route' | 'params'>,
  reason: string,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  const route = (request.route as { path?: string } | undefined)?.path ?? null;
  return { reason, method: request.method, route, ...(request.params ?? {}), ...extra };
}

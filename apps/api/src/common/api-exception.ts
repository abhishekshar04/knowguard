import { HttpException, HttpStatus } from '@nestjs/common';

export interface ApiErrorDetail {
  path: string;
  message: string;
}

/**
 * Domain error with a stable, machine-readable code (e.g. DOCUMENT_ACCESS_DENIED).
 * Messages are shown to clients: never include data the caller isn't entitled to,
 * including whether a resource exists in another organization.
 */
export class ApiException extends HttpException {
  constructor(
    readonly code: string,
    message: string,
    status: HttpStatus,
    readonly details?: ApiErrorDetail[],
  ) {
    super({ code, message }, status);
  }
}

export class RateLimitedException extends ApiException {
  constructor(readonly retryAfterSeconds: number) {
    super('RATE_LIMITED', 'Too many attempts. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
  }
}

/** Missing capability. Deliberately does not say which permission was required. */
export const forbidden = (): ApiException =>
  new ApiException('FORBIDDEN', 'You do not have permission to perform this action.', HttpStatus.FORBIDDEN);

/**
 * Resource absent OR in another organization — indistinguishable by design, so IDs from other
 * tenants reveal nothing.
 */
export const notFound = (what = 'resource'): ApiException =>
  new ApiException('NOT_FOUND', `The requested ${what} was not found.`, HttpStatus.NOT_FOUND);

/** The single response for every authentication failure; never says which check failed. */
export const unauthenticated = (): ApiException =>
  new ApiException('UNAUTHENTICATED', 'Authentication is required.', HttpStatus.UNAUTHORIZED);

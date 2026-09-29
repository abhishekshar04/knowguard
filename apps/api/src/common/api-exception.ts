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

/** The single response for every authentication failure; never says which check failed. */
export const unauthenticated = (): ApiException =>
  new ApiException('UNAUTHENTICATED', 'Authentication is required.', HttpStatus.UNAUTHORIZED);

import { HttpException, HttpStatus } from '@nestjs/common';

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
  ) {
    super({ code, message }, status);
  }
}

import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { ApiErrorBody } from '@knowguard/types';
import type { Response } from 'express';

import { ApiException, RateLimitedException } from './api-exception';

const DEFAULT_CODES: Partial<Record<number, { code: string; message: string }>> = {
  [HttpStatus.BAD_REQUEST]: { code: 'BAD_REQUEST', message: 'The request is invalid.' },
  [HttpStatus.UNAUTHORIZED]: { code: 'UNAUTHENTICATED', message: 'Authentication is required.' },
  [HttpStatus.FORBIDDEN]: {
    code: 'FORBIDDEN',
    message: 'You do not have permission to perform this action.',
  },
  [HttpStatus.NOT_FOUND]: { code: 'NOT_FOUND', message: 'The requested resource was not found.' },
  [HttpStatus.METHOD_NOT_ALLOWED]: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' },
  [HttpStatus.PAYLOAD_TOO_LARGE]: { code: 'PAYLOAD_TOO_LARGE', message: 'The request payload is too large.' },
  [HttpStatus.TOO_MANY_REQUESTS]: { code: 'RATE_LIMITED', message: 'Too many requests. Try again later.' },
};

const INTERNAL = { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' };

/**
 * Converts every error into the uniform `{ error: { code, message } }` envelope.
 * Framework/driver messages are replaced by generic ones so internals (SQL, stack traces,
 * resource existence) never leak; the original error is logged server-side only.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ApiExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const { status, body } = this.toResponse(exception);

    if (status >= 500) {
      this.logger.error(
        exception instanceof Error ? (exception.stack ?? exception.message) : String(exception),
      );
    }
    if (exception instanceof RateLimitedException) {
      response.setHeader('Retry-After', String(exception.retryAfterSeconds));
    }
    response.status(status).json(body);
  }

  private toResponse(exception: unknown): { status: number; body: ApiErrorBody } {
    if (exception instanceof ApiException) {
      return {
        status: exception.getStatus(),
        body: {
          error: {
            code: exception.code,
            message: exception.message,
            ...(exception.details ? { details: exception.details } : {}),
          },
        },
      };
    }
    const status = exception instanceof HttpException ? exception.getStatus() : clientErrorStatus(exception);
    if (status !== undefined) {
      const known =
        DEFAULT_CODES[status] ?? (status >= 500 ? INTERNAL : { code: 'ERROR', message: 'Request failed.' });
      return { status, body: { error: known } };
    }
    return { status: HttpStatus.INTERNAL_SERVER_ERROR, body: { error: INTERNAL } };
  }
}

/**
 * Express middleware (body-parser) raises `http-errors` objects such as 400 for malformed
 * JSON or 413 for oversized bodies. They flag client-safe errors with `expose: true`;
 * only the status is used — their messages are replaced with generic ones.
 */
function clientErrorStatus(exception: unknown): number | undefined {
  if (typeof exception !== 'object' || exception === null) return undefined;
  const { status, expose } = exception as { status?: unknown; expose?: unknown };
  return expose === true && typeof status === 'number' && status >= 400 && status < 500 ? status : undefined;
}

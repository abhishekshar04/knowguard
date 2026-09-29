import { HttpStatus, type PipeTransform } from '@nestjs/common';
import type { z } from '@knowguard/validation';

import { ApiException } from './api-exception';

/**
 * Validates and normalises input with a shared zod schema. Error details list the failing
 * field and rule only; submitted values are never echoed back.
 */
export class ZodValidationPipe<TSchema extends z.ZodType> implements PipeTransform<
  unknown,
  z.infer<TSchema>
> {
  constructor(private readonly schema: TSchema) {}

  transform(value: unknown): z.infer<TSchema> {
    const result = this.schema.safeParse(value ?? {});
    if (result.success) return result.data;
    throw new ApiException(
      'VALIDATION_FAILED',
      'The request is invalid.',
      HttpStatus.BAD_REQUEST,
      result.error.issues.map((issue) => ({
        path: issue.path.join('.') || (issue.code === 'unrecognized_keys' ? issue.keys.join(',') : '(body)'),
        message: issue.message,
      })),
    );
  }
}

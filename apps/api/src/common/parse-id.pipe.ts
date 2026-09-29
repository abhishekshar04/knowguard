import type { PipeTransform } from '@nestjs/common';

import { notFound } from './api-exception';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Route IDs: a malformed ID answers exactly like a well-formed ID that doesn't exist (404),
 * so probing IDs yields no information and never reaches the database as invalid input.
 */
export class ParseIdPipe implements PipeTransform<string, string> {
  constructor(private readonly what = 'resource') {}

  transform(value: string): string {
    if (!UUID.test(value)) throw notFound(this.what);
    return value.toLowerCase();
  }
}

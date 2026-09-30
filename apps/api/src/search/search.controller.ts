import { Body, Controller, Header, HttpCode, HttpStatus, Post } from '@nestjs/common';
import type { SearchResponse } from '@knowguard/types';
import { type SearchRequest, searchRequestSchema } from '@knowguard/validation';

import type { AuthContext } from '../auth/auth-context';
import { CurrentAuth } from '../auth/auth.decorators';
import { RequirePermission } from '../authorization/require-permission.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { SearchService } from './search.service';

/** POST, not GET: queries can be sensitive and should not land in URLs or access logs. */
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @RequirePermission('document.read')
  @Header('Cache-Control', 'no-store')
  search(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(searchRequestSchema)) body: SearchRequest,
  ): Promise<SearchResponse> {
    return this.searchService.search(auth, body);
  }
}

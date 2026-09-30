import { Module } from '@nestjs/common';

import { SearchController } from './search.controller';
import { SearchModels } from './search-models';
import { SearchService } from './search.service';

@Module({
  controllers: [SearchController],
  providers: [SearchModels, SearchService],
  exports: [SearchService, SearchModels],
})
export class SearchModule {}

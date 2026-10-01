import { Module } from '@nestjs/common';

import { SearchModule } from '../search/search.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { chatProviderProvider } from './chat-provider';
import { ConversationsService } from './conversations.service';

@Module({
  imports: [SearchModule],
  controllers: [AiController],
  providers: [chatProviderProvider, AiService, ConversationsService],
})
export class AiModule {}

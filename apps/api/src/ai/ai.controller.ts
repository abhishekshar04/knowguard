import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import type {
  AiStatusResponse,
  AiStreamEvent,
  ConversationDetails,
  ConversationListResponse,
} from '@knowguard/types';
import { type AiQueryInput, aiQuerySchema } from '@knowguard/validation';
import type { Response } from 'express';

import type { AuthContext } from '../auth/auth-context';
import { CurrentAuth } from '../auth/auth.decorators';
import { RequirePermission } from '../authorization/require-permission.decorator';
import { ParseIdPipe } from '../common/parse-id.pipe';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AiService } from './ai.service';
import { ConversationsService } from './conversations.service';

const conversationId = new ParseIdPipe('conversation');

@Controller('ai')
@RequirePermission('ai.query')
export class AiController {
  private readonly logger = new Logger(AiController.name);

  constructor(
    private readonly ai: AiService,
    private readonly conversations: ConversationsService,
  ) {}

  @Get('status')
  status(): AiStatusResponse {
    return this.ai.status();
  }

  /**
   * Answers as Server-Sent Events (see AiStreamEvent). Validation, authorization, rate-limit and
   * configuration failures are ordinary JSON errors, because they happen before streaming starts.
   */
  @Post('query')
  async query(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(aiQuerySchema)) body: AiQueryInput,
    @Res() res: Response,
  ): Promise<void> {
    const prepared = await this.ai.prepare(auth, body);

    const abort = new AbortController();
    res.on('close', () => {
      if (!res.writableFinished) abort.abort();
    });
    res.status(HttpStatus.OK);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Accel-Buffering', 'no'); // stop reverse proxies from buffering the stream
    res.flushHeaders();

    const send = (event: AiStreamEvent) => {
      if (!res.writableEnded && !res.destroyed)
        res.write(`event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`);
    };
    try {
      // Keep consuming after a disconnect, so the outcome is still recorded.
      for await (const event of prepared.events(abort.signal)) send(event);
    } catch (error) {
      this.logger.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
      send({ event: 'error', data: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } });
    }
    res.end();
  }

  @Get('conversations')
  @Header('Cache-Control', 'no-store')
  list(@CurrentAuth() auth: AuthContext): Promise<ConversationListResponse> {
    return this.conversations.list(auth);
  }

  @Get('conversations/:id')
  @Header('Cache-Control', 'no-store')
  get(
    @CurrentAuth() auth: AuthContext,
    @Param('id', conversationId) id: string,
  ): Promise<ConversationDetails> {
    return this.conversations.get(auth, id);
  }

  @Delete('conversations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentAuth() auth: AuthContext, @Param('id', conversationId) id: string): Promise<void> {
    return this.conversations.remove(auth, id);
  }
}

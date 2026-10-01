import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { type ChatProvider, ChatProviderError, type ChatUsage } from '@knowguard/ai';
import { readableDocumentsWhere } from '@knowguard/database';
import type { AiSource, AiStatusResponse, AiStreamEvent } from '@knowguard/types';
import type { AiQueryInput } from '@knowguard/validation';

import { type AuthContext, toAuthorizationContext } from '../auth/auth-context';
import { ApiException, notFound } from '../common/api-exception';
import { PrismaService } from '../common/prisma.service';
import { type RateLimitRule, RateLimiterService } from '../common/rate-limiter.service';
import { API_ENV, type ApiEnv } from '../config/api-env';
import { SearchModels } from '../search/search-models';
import { type RetrievedPassage, SearchService } from '../search/search.service';
import { CHAT_PROVIDER } from './chat-provider';
import { ConversationsService } from './conversations.service';
import { buildMessages, parseCitations, type PromptTurn } from './prompt';

/** Each question costs a paid model call: bound it per member and per organization. */
const USER_RATE_LIMIT: RateLimitRule = { limit: 20, windowSeconds: 60 };
const ORGANIZATION_RATE_LIMIT: RateLimitRule = { limit: 300, windowSeconds: 60 * 60 };
/** Passages given to the model, and at most this many from one document (unless scoped to it). */
const MAX_SOURCES = 8;
const MAX_SOURCES_PER_DOCUMENT = 3;
/**
 * Cross-encoder relevance cut-offs (measured, see ADR 0011). Unrelated questions score below
 * ~0.0005, while real but indirect questions ("summarize the travel policy") can score under 0.01,
 * so the absolute floor is low. The relative floor drops filler passages next to a strong match.
 */
const RELEVANCE_FLOOR = 0.001;
const RELATIVE_RELEVANCE_FLOOR = 0.05;
/** Short follow-ups ("and for managers?") are retrieved together with the previous question. */
const FOLLOW_UP_MAX_WORDS = 8;

export const NO_ANSWER = "I couldn't find information about that in the documents you have access to.";

export interface PreparedAnswer {
  conversationId: string;
  /** Streams the answer and records it; runs to completion even if the client disconnects. */
  events(signal: AbortSignal): AsyncGenerator<AiStreamEvent>;
}

/**
 * Ask AI (spec §23–26): permission-aware retrieval → grounded prompt → streamed answer with
 * citations. Authorization happens in retrieval, before the prompt exists: the model only ever
 * receives passages the requester may read (SearchService.retrieve), never "everything, with
 * instructions to hold some back".
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    @Inject(CHAT_PROVIDER) private readonly provider: ChatProvider | null,
    @Inject(API_ENV) private readonly env: ApiEnv,
    private readonly prisma: PrismaService,
    private readonly rateLimiter: RateLimiterService,
    private readonly search: SearchService,
    private readonly models: SearchModels,
    private readonly conversations: ConversationsService,
  ) {}

  status(): AiStatusResponse {
    return { available: this.provider !== null, model: this.provider?.model ?? null };
  }

  /** Everything that can fail as a normal HTTP error happens here, before streaming starts. */
  async prepare(auth: AuthContext, query: AiQueryInput): Promise<PreparedAnswer> {
    const provider = this.provider;
    if (!provider) {
      throw new ApiException(
        'AI_UNAVAILABLE',
        'The AI assistant is not configured.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    await this.rateLimiter.consume(`ai:user:${auth.userId}`, USER_RATE_LIMIT);
    await this.rateLimiter.consume(`ai:org:${auth.organizationId}`, ORGANIZATION_RATE_LIMIT);

    if (query.documentId) await this.assertAskable(auth, query.documentId);
    const existing = query.conversationId
      ? await this.conversations.findOwned(auth, query.conversationId)
      : null;
    const history = existing ? await this.conversations.history(auth, existing.id) : [];

    const passages = await this.search.retrieve(auth, retrievalQuery(query.message, history), {
      maxPassages: MAX_SOURCES,
      maxPerDocument: query.documentId ? MAX_SOURCES : MAX_SOURCES_PER_DOCUMENT,
      ...(query.documentId ? { restrictTo: [query.documentId] } : {}),
    });
    // A document the user chose is used as-is; otherwise drop passages that are about something else.
    const relevant = query.documentId || !this.models.reranker ? passages : relevantPassages(passages);

    const conversation = existing ?? (await this.conversations.create(auth, query.message));
    await this.conversations.addMessage(auth, conversation.id, { role: 'USER', content: query.message });

    return {
      conversationId: conversation.id,
      events: (signal) =>
        this.generate({
          auth,
          provider,
          conversationId: conversation.id,
          question: query.message,
          history,
          passages: relevant,
          signal,
        }),
    };
  }

  private async *generate(input: {
    auth: AuthContext;
    provider: ChatProvider;
    conversationId: string;
    question: string;
    history: PromptTurn[];
    passages: RetrievedPassage[];
    signal: AbortSignal;
  }): AsyncGenerator<AiStreamEvent> {
    const { auth, provider, conversationId, passages, signal } = input;
    const sources = passages.map(toSource);
    yield { event: 'meta', data: { conversationId } };
    yield { event: 'sources', data: { sources } };

    // Nothing relevant the requester may read: say so without calling the model.
    if (sources.length === 0) {
      const messageId = await this.conversations.addMessage(auth, conversationId, {
        role: 'ASSISTANT',
        content: NO_ANSWER,
      });
      yield { event: 'delta', data: { text: NO_ANSWER } };
      yield { event: 'done', data: { messageId, answer: NO_ANSWER, sources, usage: null } };
      return;
    }

    const messages = buildMessages({
      history: input.history,
      question: input.question,
      sources: passages.map((p, i) => ({
        index: i + 1,
        title: p.title,
        section: p.section,
        page: p.page,
        content: p.content,
      })),
    });

    let answer = '';
    let usage: ChatUsage | null = null;
    const started = Date.now();
    try {
      for await (const event of provider.stream({
        messages,
        maxOutputTokens: this.env.AI_MAX_OUTPUT_TOKENS,
        signal,
      })) {
        if (event.type === 'delta') {
          answer += event.text;
          yield { event: 'delta', data: { text: event.text } };
        } else {
          usage = event.usage;
        }
      }
      if (!answer.trim()) {
        throw new ChatProviderError(
          'unavailable',
          'The AI assistant did not return an answer. Please try again.',
        );
      }
    } catch (error) {
      const failure = toClientError(error, signal.aborted);
      this.logger.warn(
        `AI answer failed (${failure.code}) for conversation ${conversationId}: ${(error as Error).message}`,
      );
      await this.conversations.addMessage(auth, conversationId, {
        role: 'ASSISTANT',
        status: 'FAILED',
        content: answer,
        sources,
        model: provider.model,
        usage,
      });
      if (!signal.aborted) yield { event: 'error', data: failure };
      return;
    }

    const cited = new Set(parseCitations(answer, sources.length));
    const finalSources = sources.map((s) => ({ ...s, cited: cited.has(s.index) }));
    const messageId = await this.conversations.addMessage(auth, conversationId, {
      role: 'ASSISTANT',
      content: answer,
      sources: finalSources,
      model: provider.model,
      usage,
    });
    // Metadata only: questions, sources and answers are never logged.
    this.logger.log(
      `AI answer ${messageId}: model=${provider.model} sources=${sources.length} cited=${cited.size} ` +
        `promptTokens=${usage?.promptTokens ?? '?'} outputTokens=${usage?.outputTokens ?? '?'} ms=${Date.now() - started}`,
    );
    yield { event: 'done', data: { messageId, answer, sources: finalSources, usage } };
  }

  /** "Ask AI about this document": same 404 as the document endpoints when it is not readable. */
  private async assertAskable(auth: AuthContext, documentId: string): Promise<void> {
    const document = await this.prisma.document.findFirst({
      where: { AND: [readableDocumentsWhere(toAuthorizationContext(auth)), { id: documentId }] },
      select: { status: true },
    });
    if (!document) throw notFound('document');
    if (document.status !== 'READY') {
      throw new ApiException(
        'DOCUMENT_NOT_READY',
        'This document is still being processed. Try again when it is ready.',
        HttpStatus.CONFLICT,
      );
    }
  }
}

function relevantPassages(passages: readonly RetrievedPassage[]): RetrievedPassage[] {
  const best = Math.max(0, ...passages.map((p) => p.score));
  const floor = Math.max(RELEVANCE_FLOOR, best * RELATIVE_RELEVANCE_FLOOR);
  return passages.filter((p) => p.score >= floor);
}

function retrievalQuery(question: string, history: readonly PromptTurn[]): string {
  const previous = history.findLast((turn) => turn.role === 'user');
  if (!previous || question.split(/\s+/).length > FOLLOW_UP_MAX_WORDS) return question;
  return `${previous.content}\n${question}`;
}

function toSource(passage: RetrievedPassage, i: number): AiSource {
  return {
    index: i + 1,
    documentId: passage.documentId,
    documentTitle: passage.title,
    version: passage.version,
    versionId: passage.versionId,
    page: passage.page,
    section: passage.section,
    chunkId: passage.chunkId,
    cited: false,
  };
}

const PROVIDER_ERROR_CODES: Record<ChatProviderError['kind'], string> = {
  rate_limited: 'AI_RATE_LIMITED',
  quota_exceeded: 'AI_QUOTA_EXCEEDED',
  unauthorized: 'AI_UNAVAILABLE',
  unavailable: 'AI_UNAVAILABLE',
  rejected: 'AI_REJECTED',
};

function toClientError(error: unknown, aborted: boolean): { code: string; message: string } {
  if (aborted) return { code: 'AI_CANCELLED', message: 'The answer was cancelled.' };
  if (error instanceof ChatProviderError)
    return { code: PROVIDER_ERROR_CODES[error.kind], message: error.message };
  return { code: 'AI_UNAVAILABLE', message: 'The AI assistant is temporarily unavailable.' };
}

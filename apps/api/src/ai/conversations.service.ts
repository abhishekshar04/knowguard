import { Injectable } from '@nestjs/common';
import { type Prisma, readableDocumentsWhere } from '@knowguard/database';
import type {
  AiSource,
  AiUsage,
  ConversationDetails,
  ConversationListResponse,
  ConversationMessageView,
} from '@knowguard/types';

import { type AuthContext, toAuthorizationContext } from '../auth/auth-context';
import { notFound } from '../common/api-exception';
import { PrismaService } from '../common/prisma.service';
import type { PromptTurn } from './prompt';

/** Earlier messages given to the model as conversation context. */
const HISTORY_MESSAGES = 6;
const LIST_LIMIT = 50;
const TITLE_CHARS = 80;

/** Shown instead of an answer whose sources the viewer can no longer read. */
export const REDACTED_ANSWER =
  'This answer is hidden because you no longer have access to one or more of the documents it was based on.';

type MessageRow = Prisma.ConversationMessageGetPayload<object>;

/**
 * Conversations are private to the member who started them: every query is scoped by
 * organization AND user, and anyone else gets the same 404 as for a missing conversation.
 *
 * An assistant answer is derived from documents, so it is only as readable as they are: once any
 * of its source documents is no longer readable by the viewer, the answer is redacted when shown
 * and left out of the context of later questions.
 */
@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(auth: AuthContext): Promise<ConversationListResponse> {
    const conversations = await this.prisma.conversation.findMany({
      where: { organizationId: auth.organizationId, userId: auth.userId },
      orderBy: { updatedAt: 'desc' },
      take: LIST_LIMIT,
      select: { id: true, title: true, updatedAt: true },
    });
    return {
      conversations: conversations.map((c) => ({
        id: c.id,
        title: c.title,
        updatedAt: c.updatedAt.toISOString(),
      })),
    };
  }

  async get(auth: AuthContext, id: string): Promise<ConversationDetails> {
    const conversation = await this.findOwned(auth, id);
    const messages = await this.prisma.conversationMessage.findMany({
      where: { conversationId: conversation.id, organizationId: auth.organizationId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    const hidden = await this.unreadableAnswers(auth, messages);
    return {
      id: conversation.id,
      title: conversation.title,
      updatedAt: conversation.updatedAt.toISOString(),
      messages: messages.map((m) => toView(m, hidden.has(m.id))),
    };
  }

  async remove(auth: AuthContext, id: string): Promise<void> {
    const { count } = await this.prisma.conversation.deleteMany({
      where: { id, organizationId: auth.organizationId, userId: auth.userId },
    });
    if (count === 0) throw notFound('conversation');
  }

  async findOwned(auth: AuthContext, id: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id, organizationId: auth.organizationId, userId: auth.userId },
    });
    if (!conversation) throw notFound('conversation');
    return conversation;
  }

  create(auth: AuthContext, question: string) {
    const oneLine = question.replace(/\s+/g, ' ').trim();
    const title = oneLine.length > TITLE_CHARS ? `${oneLine.slice(0, TITLE_CHARS - 1)}…` : oneLine;
    return this.prisma.conversation.create({
      data: { organizationId: auth.organizationId, userId: auth.userId, title },
    });
  }

  /** Earlier complete turns the viewer may still see, oldest first. */
  async history(auth: AuthContext, conversationId: string): Promise<PromptTurn[]> {
    const recent = await this.prisma.conversationMessage.findMany({
      where: { conversationId, organizationId: auth.organizationId, status: 'COMPLETE' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: HISTORY_MESSAGES,
    });
    const hidden = await this.unreadableAnswers(auth, recent);
    return recent
      .reverse()
      .filter((m) => !hidden.has(m.id))
      .map((m) => ({ role: m.role === 'USER' ? 'user' : 'assistant', content: m.content }));
  }

  async addMessage(
    auth: AuthContext,
    conversationId: string,
    message: {
      role: 'USER' | 'ASSISTANT';
      status?: 'COMPLETE' | 'FAILED';
      content: string;
      sources?: AiSource[];
      model?: string;
      usage?: AiUsage | null;
    },
  ): Promise<string> {
    const [created] = await this.prisma.$transaction([
      this.prisma.conversationMessage.create({
        data: {
          organizationId: auth.organizationId,
          conversationId,
          role: message.role,
          status: message.status ?? 'COMPLETE',
          content: message.content,
          sources: (message.sources ?? []) as unknown as Prisma.InputJsonValue,
          model: message.model ?? null,
          promptTokens: message.usage?.promptTokens ?? null,
          outputTokens: message.usage?.outputTokens ?? null,
        },
        select: { id: true },
      }),
      // Bumps updatedAt so the conversation list is ordered by activity.
      this.prisma.conversation.update({
        where: { id_organizationId: { id: conversationId, organizationId: auth.organizationId } },
        data: { updatedAt: new Date() },
        select: { id: true },
      }),
    ]);
    return created.id;
  }

  /** IDs of assistant messages based on at least one document the viewer cannot read now. */
  private async unreadableAnswers(auth: AuthContext, messages: readonly MessageRow[]): Promise<Set<string>> {
    const documentIds = new Set(
      messages
        .filter((m) => m.role === 'ASSISTANT')
        .flatMap((m) => toSources(m.sources).map((s) => s.documentId)),
    );
    if (documentIds.size === 0) return new Set();
    const readable = await this.prisma.document.findMany({
      where: {
        AND: [readableDocumentsWhere(toAuthorizationContext(auth)), { id: { in: [...documentIds] } }],
      },
      select: { id: true },
    });
    const readableIds = new Set(readable.map((d) => d.id));
    return new Set(
      messages
        .filter(
          (m) => m.role === 'ASSISTANT' && toSources(m.sources).some((s) => !readableIds.has(s.documentId)),
        )
        .map((m) => m.id),
    );
  }
}

/** Sources are written only by this service, always as an AiSource array. */
function toSources(value: Prisma.JsonValue): AiSource[] {
  return Array.isArray(value) ? (value as unknown as AiSource[]) : [];
}

function toView(message: MessageRow, hidden: boolean): ConversationMessageView {
  return {
    id: message.id,
    role: message.role,
    status: message.status,
    content: hidden ? REDACTED_ANSWER : message.content,
    sources: hidden ? [] : toSources(message.sources),
    createdAt: message.createdAt.toISOString(),
  };
}

import type {
  AiStatusResponse,
  ConversationDetails,
  ConversationListResponse,
  DocumentDetails,
} from '@knowguard/types';
import { MessageSquare, Plus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ActionForm } from '@/components/admin/action-form';
import { AskView } from '@/components/ask/ask-view';
import { AccessDenied, PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ApiError, apiRequest } from '@/lib/api';
import { can } from '@/lib/permissions';
import { getSessionToken, requireUser } from '@/lib/session';
import { cn } from '@/lib/utils';

import { deleteConversationAction } from './actions';

export const metadata: Metadata = { title: 'Ask AI' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function loadOrNull<T>(path: string, token: string): Promise<T | null> {
  try {
    return await apiRequest<T>(path, { token });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export default async function AskPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string | string[]; document?: string | string[] }>;
}) {
  const me = await requireUser();
  if (!can(me, 'ai.query')) return <AccessDenied what="Ask AI" />;
  const token = (await getSessionToken())!;
  const params = await searchParams;
  const conversationId = typeof params.c === 'string' && UUID.test(params.c) ? params.c : null;
  const documentId =
    typeof params.document === 'string' && UUID.test(params.document) ? params.document : null;

  const [status, { conversations }, conversation, document] = await Promise.all([
    apiRequest<AiStatusResponse>('/ai/status', { token }),
    apiRequest<ConversationListResponse>('/ai/conversations', { token }),
    conversationId ? loadOrNull<ConversationDetails>(`/ai/conversations/${conversationId}`, token) : null,
    documentId ? loadOrNull<DocumentDetails>(`/documents/${documentId}`, token) : null,
  ]);
  // Someone else's conversation looks exactly like a missing one.
  if (conversationId && !conversation) notFound();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Ask AI"
        description="Answers come only from documents you are allowed to read, with citations to the exact passages."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={documentId ? `/ask?document=${documentId}` : '/ask'}>
              <Plus aria-hidden />
              New conversation
            </Link>
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
        <nav aria-label="Conversations" className="flex flex-col gap-1" data-testid="conversation-list">
          {conversations.length === 0 ? (
            <p className="px-2 text-sm text-muted-foreground">No conversations yet.</p>
          ) : (
            conversations.map((c) => (
              <Link
                key={c.id}
                href={`/ask?c=${c.id}`}
                aria-current={c.id === conversationId ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent',
                  c.id === conversationId && 'bg-accent font-medium',
                )}
              >
                <MessageSquare className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="truncate">{c.title}</span>
              </Link>
            ))
          )}
        </nav>

        <div className="flex min-w-0 flex-col gap-4">
          {!status.available ? (
            <Card data-testid="ai-unavailable">
              <CardContent className="text-sm">
                <p className="font-medium">The AI assistant is not configured.</p>
                <p className="text-muted-foreground">
                  An administrator needs to set up an AI provider. Search still works.
                </p>
              </CardContent>
            </Card>
          ) : null}
          {documentId && !document ? (
            <p role="alert" className="text-sm text-destructive">
              That document was not found. Questions will use all documents you can read.
            </p>
          ) : null}

          <AskView
            key={conversation?.id ?? `new-${documentId ?? ''}`}
            conversationId={conversation?.id ?? null}
            initialMessages={conversation?.messages ?? []}
            document={
              document ? { id: document.id, title: document.title, ready: document.status === 'READY' } : null
            }
            disabled={!status.available}
          />

          {conversation ? (
            <ActionForm
              action={deleteConversationAction}
              hidden={{ conversationId: conversation.id }}
              submitLabel="Delete conversation"
              pendingLabel="Deleting…"
              variant="ghost"
              inline
              quiet
              className="self-end"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

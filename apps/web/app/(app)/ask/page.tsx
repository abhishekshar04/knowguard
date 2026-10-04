import type {
  AiStatusResponse,
  ConversationDetails,
  ConversationListResponse,
  DocumentDetails,
} from '@knowguard/types';
import { ChevronDown, CircleAlert, MessageSquare, Plus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ActionForm } from '@/components/admin/action-form';
import { AskView } from '@/components/ask/ask-view';
import { timeAgo } from '@/components/documents/document-labels';
import { AccessDenied } from '@/components/page-header';
import { Button } from '@/components/ui/button';
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

  const newHref = documentId ? `/ask?document=${documentId}` : '/ask';
  const list = (testId?: string) => (
    <nav aria-label="Conversations" className="flex flex-col gap-0.5" data-testid={testId}>
      {conversations.length === 0 ? (
        <p className="px-3 py-2 text-sm text-muted-foreground">No conversations yet.</p>
      ) : (
        conversations.map((c) => (
          <Link
            key={c.id}
            href={`/ask?c=${c.id}`}
            aria-current={c.id === conversationId ? 'page' : undefined}
            className={cn(
              'flex flex-col rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent',
              c.id === conversationId && 'bg-ink/[0.06]',
            )}
          >
            <span className={cn('truncate', c.id === conversationId && 'font-medium')}>{c.title}</span>
            <span className="text-xs text-muted-foreground">{timeAgo(c.updatedAt)}</span>
          </Link>
        ))
      )}
    </nav>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="hidden flex-col gap-3 lg:sticky lg:top-20 lg:flex lg:max-h-[calc(100dvh-7rem)]">
        <Button asChild className="w-full justify-start">
          <Link href={newHref}>
            <Plus aria-hidden />
            New conversation
          </Link>
        </Button>
        <p className="px-3 pt-2 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
          Recent
        </p>
        <div className="-mx-1 overflow-y-auto px-1">{list('conversation-list')}</div>
      </aside>

      <section className="flex min-w-0 flex-col gap-4" aria-labelledby="ask-title">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1
              id="ask-title"
              className="font-display text-[1.75rem] leading-[1.1] font-bold tracking-[-0.03em]"
            >
              Ask AI
            </h1>
            <p className="text-sm text-muted-foreground">
              Answers come only from documents you are allowed to read, with citations to the exact passages.
            </p>
          </div>
          <div className="flex gap-2">
            {conversation ? (
              <ActionForm
                action={deleteConversationAction}
                hidden={{ conversationId: conversation.id }}
                submitLabel="Delete conversation"
                pendingLabel="Deleting…"
                variant="ghost"
                inline
                quiet
              />
            ) : null}
            <Button asChild variant="outline" size="sm" className="lg:hidden">
              <Link href={newHref}>
                <Plus aria-hidden />
                New
              </Link>
            </Button>
          </div>
        </header>

        {conversations.length > 0 ? (
          <details className="group rounded-xl border bg-card lg:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2">
                <MessageSquare className="size-4 text-muted-foreground" aria-hidden />
                Your conversations ({conversations.length})
              </span>
              <ChevronDown
                className="size-4 text-muted-foreground transition-transform group-open:rotate-180"
                aria-hidden
              />
            </summary>
            <div className="border-t p-1.5">{list()}</div>
          </details>
        ) : null}

        {!status.available ? (
          <div
            data-testid="ai-unavailable"
            className="flex items-start gap-3 rounded-xl border border-warning/25 bg-warning/[0.07] px-4 py-3 text-sm"
          >
            <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
            <div>
              <p className="font-medium">The AI assistant is not configured.</p>
              <p className="text-muted-foreground">
                An administrator needs to set up an AI provider. Search still works.
              </p>
            </div>
          </div>
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
      </section>
    </div>
  );
}

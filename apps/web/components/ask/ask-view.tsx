'use client';

import type { AiSource, ConversationMessageView } from '@knowguard/types';
import { Bot, FileText, Send, Square, User } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Fragment, type KeyboardEvent, useEffect, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import { createSseParser, splitCitations } from './sse';

interface Turn {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  sources: AiSource[];
  status: 'COMPLETE' | 'FAILED' | 'STREAMING';
  error?: string;
}

interface AskViewProps {
  conversationId: string | null;
  initialMessages: ConversationMessageView[];
  /** "Ask AI about this document": questions are answered from this document only. */
  document: { id: string; title: string; ready: boolean } | null;
  disabled: boolean;
}

const MAX_MESSAGE = 4000;

export function AskView({ conversationId, initialMessages, document, disabled }: AskViewProps) {
  const router = useRouter();
  const [turns, setTurns] = useState<Turn[]>(() => initialMessages.map((m) => ({ ...m })));
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Block body: scrollIntoView returns a Promise in newer browsers, which React would treat
    // as an effect cleanup function.
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [turns]);
  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  const updateAnswer = (update: (turn: Turn) => Turn) =>
    setTurns((all) => all.map((t, i) => (i === all.length - 1 && t.role === 'ASSISTANT' ? update(t) : t)));

  async function ask() {
    const question = message.trim();
    if (!question || streaming) return;
    setError(null);
    setMessage('');
    setStreaming(true);
    const abort = new AbortController();
    abortRef.current = abort;
    setTurns((all) => [
      ...all,
      { id: `q-${all.length}`, role: 'USER', content: question, sources: [], status: 'COMPLETE' },
      { id: `a-${all.length}`, role: 'ASSISTANT', content: '', sources: [], status: 'STREAMING' },
    ]);

    let createdConversation: string | null = null;
    let finished = false;
    try {
      const res = await fetch('/ask/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: question,
          ...(conversationId ? { conversationId } : {}),
          ...(document ? { documentId: document.id } : {}),
        }),
        signal: abort.signal,
      });
      if (!res.ok || !res.body) {
        if (res.status === 401) {
          // A route handler (clears the cookie), not a page: a full navigation is intended.
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.assign('/auth/session-ended');
          return;
        }
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        // Nothing was recorded: remove the pending turn and give the question back.
        setTurns((all) => all.slice(0, -2));
        setMessage(question);
        setError(body?.error?.message ?? 'The AI assistant is temporarily unavailable.');
        return;
      }

      const parse = createSseParser();
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const event of parse(value)) {
          switch (event.event) {
            case 'meta':
              if (!conversationId) createdConversation = event.data.conversationId;
              break;
            case 'sources':
              updateAnswer((t) => ({ ...t, sources: event.data.sources }));
              break;
            case 'delta':
              updateAnswer((t) => ({ ...t, content: t.content + event.data.text }));
              break;
            case 'done':
              finished = true;
              updateAnswer((t) => ({
                ...t,
                id: event.data.messageId,
                content: event.data.answer,
                sources: event.data.sources,
                status: 'COMPLETE',
              }));
              break;
            case 'error':
              finished = true;
              updateAnswer((t) => ({ ...t, status: 'FAILED', error: event.data.message }));
              break;
          }
        }
      }
      if (!finished) updateAnswer((t) => ({ ...t, status: 'FAILED', error: 'The answer was interrupted.' }));
    } catch {
      updateAnswer((t) => ({
        ...t,
        status: 'FAILED',
        error: abort.signal.aborted ? 'Stopped.' : 'The connection was lost.',
      }));
    } finally {
      setStreaming(false);
      abortRef.current = null;
      if (createdConversation) {
        const scope = document ? `&document=${document.id}` : '';
        router.replace(`/ask?c=${createdConversation}${scope}`, { scroll: false });
      } else {
        router.refresh(); // reorders the conversation list
      }
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void ask();
    }
  }

  const blocked = disabled || (document !== null && !document.ready);

  return (
    <div className="flex flex-col gap-4">
      {document ? (
        <p className="flex flex-wrap items-center gap-2 text-sm" data-testid="ask-scope">
          <span className="text-muted-foreground">Asking about</span>
          <Link
            href={`/documents/${document.id}`}
            className="flex items-center gap-1.5 font-medium hover:underline"
          >
            <FileText className="size-4 text-muted-foreground" aria-hidden />
            {document.title}
          </Link>
          {!document.ready ? <Badge variant="outline">Still processing</Badge> : null}
        </p>
      ) : null}

      <ol className="flex flex-col gap-4" data-testid="ask-thread" aria-busy={streaming}>
        {turns.length === 0 ? (
          <li className="text-sm text-muted-foreground">
            Ask a question about your organization&apos;s documents, for example “How do we roll back a
            release?”
          </li>
        ) : null}
        {turns.map((turn) =>
          turn.role === 'USER' ? (
            <li key={turn.id} className="flex gap-3" data-testid="ask-question">
              <User className="mt-1 size-4 shrink-0 text-muted-foreground" aria-label="You" />
              <p className="whitespace-pre-wrap text-sm font-medium">{turn.content}</p>
            </li>
          ) : (
            <li key={turn.id} className="flex gap-3">
              <Bot className="mt-1 size-4 shrink-0 text-muted-foreground" aria-label="Assistant" />
              <Answer turn={turn} />
            </li>
          ),
        )}
      </ol>
      <div ref={endRef} />

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void ask();
        }}
      >
        <label htmlFor="ask-message" className="sr-only">
          Your question
        </label>
        <textarea
          id="ask-message"
          name="message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={onKeyDown}
          maxLength={MAX_MESSAGE}
          rows={3}
          disabled={blocked}
          placeholder={document ? `Ask about “${document.title}”…` : 'Ask a question…'}
          className={cn(
            'w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50',
            'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
          )}
          autoFocus
        />
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">Enter to send · Shift+Enter for a new line</p>
          {streaming ? (
            <Button type="button" variant="outline" onClick={() => abortRef.current?.abort()}>
              <Square aria-hidden />
              Stop
            </Button>
          ) : (
            <Button type="submit" disabled={blocked || !message.trim()}>
              <Send aria-hidden />
              Ask
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

function Answer({ turn }: { turn: Turn }) {
  const byIndex = new Map(turn.sources.map((s) => [s.index, s]));
  const shown = turn.status === 'STREAMING' ? turn.sources : turn.sources.filter((s) => s.cited);
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3" data-testid="ask-answer" data-status={turn.status}>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">
        {turn.content === '' && turn.status === 'STREAMING' ? (
          <span className="text-muted-foreground">Searching your documents…</span>
        ) : (
          splitCitations(turn.content).map((part, i) =>
            part.type === 'text' ? (
              <Fragment key={i}>{part.text}</Fragment>
            ) : (
              <Fragment key={i}>
                {part.indexes.map((n) => {
                  const source = byIndex.get(n);
                  return source ? (
                    <Link
                      key={n}
                      href={`/documents/${source.documentId}`}
                      title={`${source.documentTitle}${source.section ? ` — ${source.section}` : ''}`}
                      aria-label={`Source ${n}: ${source.documentTitle}`}
                      className="mx-0.5 rounded bg-accent px-1 align-super text-[0.7rem] font-medium hover:underline"
                      data-testid="citation"
                    >
                      {n}
                    </Link>
                  ) : null;
                })}
              </Fragment>
            ),
          )
        )}
      </p>
      {turn.error ? (
        <p role="alert" className="text-sm text-destructive">
          {turn.error}
        </p>
      ) : null}
      {shown.length > 0 ? (
        <Card className="gap-0 py-3">
          <CardContent className="flex flex-col gap-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              {turn.status === 'STREAMING' ? 'Reading' : 'Sources'}
            </p>
            <ol className="flex flex-col gap-1" data-testid="ask-sources">
              {shown.map((source) => (
                <li key={source.index} className="flex items-baseline gap-2 text-sm">
                  <span className="w-5 shrink-0 text-xs tabular-nums text-muted-foreground">
                    {source.index}.
                  </span>
                  <Link href={`/documents/${source.documentId}`} className="font-medium hover:underline">
                    {source.documentTitle}
                  </Link>
                  <span className="truncate text-xs text-muted-foreground">
                    {[source.section, source.page ? `page ${source.page}` : null, `v${source.version}`]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

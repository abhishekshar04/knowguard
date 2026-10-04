'use client';

import type { AiSource, ConversationMessageView } from '@knowguard/types';
import { FileText, Send, Sparkles, Square } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Fragment, type KeyboardEvent, useEffect, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

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
  const textarea = useRef<HTMLTextAreaElement>(null);

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
    <div className="flex min-h-[calc(100dvh-12rem)] flex-col">
      {document ? (
        <p
          className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border bg-signal-soft/60 px-3 py-2 text-sm"
          data-testid="ask-scope"
        >
          <span className="text-muted-foreground">Asking about</span>
          <Link
            href={`/documents/${document.id}`}
            className="flex items-center gap-1.5 font-medium underline-offset-4 hover:underline"
          >
            <FileText className="size-4 text-signal" aria-hidden />
            {document.title}
          </Link>
          {!document.ready ? <Badge variant="outline">Still processing</Badge> : null}
        </p>
      ) : null}

      <ol className="flex flex-1 flex-col gap-6" data-testid="ask-thread" aria-busy={streaming}>
        {turns.length === 0 ? (
          <li className="flex flex-1 flex-col items-center justify-center gap-5 py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-ink text-white">
              <Sparkles className="size-5" aria-hidden />
            </span>
            <div className="flex flex-col gap-1.5">
              <p className="font-display text-xl font-semibold tracking-tight">
                What would you like to know?
              </p>
              <p className="max-w-md text-sm text-muted-foreground">
                Ask a question about your organization&apos;s documents, for example “How do we roll back a
                release?”
              </p>
            </div>
            {!blocked ? (
              <div className="flex max-w-xl flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => {
                      setMessage(suggestion);
                      textarea.current?.focus();
                    }}
                    className="cursor-pointer rounded-full border bg-card px-3.5 py-1.5 text-sm text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            ) : null}
          </li>
        ) : null}
        {turns.map((turn) =>
          turn.role === 'USER' ? (
            <li key={turn.id} className="flex justify-end">
              <p
                className="max-w-[85%] rounded-2xl rounded-br-md bg-ink px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap text-white"
                data-testid="ask-question"
              >
                {turn.content}
              </p>
            </li>
          ) : (
            <li key={turn.id} className="flex gap-3">
              <span
                className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-signal-soft text-signal"
                aria-label="Assistant"
                role="img"
              >
                <Sparkles className="size-4" aria-hidden />
              </span>
              <Answer turn={turn} />
            </li>
          ),
        )}
      </ol>
      <div ref={endRef} />

      <div className="sticky bottom-0 -mx-1 mt-6 bg-gradient-to-t from-background via-background to-transparent px-1 pt-4 pb-1">
        {error ? (
          <p role="alert" className="mb-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <form
          className="rounded-2xl border bg-card p-2 shadow-[0_12px_32px_-18px_rgb(11_13_18/0.35)] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/15"
          onSubmit={(event) => {
            event.preventDefault();
            void ask();
          }}
        >
          <label htmlFor="ask-message" className="sr-only">
            Your question
          </label>
          <textarea
            ref={textarea}
            id="ask-message"
            name="message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={onKeyDown}
            maxLength={MAX_MESSAGE}
            rows={2}
            disabled={blocked}
            placeholder={document ? `Ask about “${document.title}”…` : 'Ask a question…'}
            className="field-sizing-content max-h-48 min-h-14 w-full resize-none bg-transparent px-2.5 py-2 text-[15px] outline-none placeholder:text-muted-foreground/80 disabled:cursor-not-allowed disabled:opacity-50"
            autoFocus
          />
          <div className="flex items-center justify-between gap-2 pl-2.5">
            <p className="hidden text-xs text-muted-foreground sm:block">
              Enter to send, Shift+Enter for a new line
            </p>
            <span className="sm:hidden" />
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
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Answers use only documents you can read. Check the sources for anything important.
        </p>
      </div>
    </div>
  );
}

const SUGGESTIONS = [
  'Summarize our expense policy',
  'How do we roll back a release?',
  'What changed in the latest handbook?',
];

function Answer({ turn }: { turn: Turn }) {
  const byIndex = new Map(turn.sources.map((s) => [s.index, s]));
  const shown = turn.status === 'STREAMING' ? turn.sources : turn.sources.filter((s) => s.cited);
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3" data-testid="ask-answer" data-status={turn.status}>
      <p className="pt-1 text-[15px] leading-relaxed whitespace-pre-wrap">
        {turn.content === '' && turn.status === 'STREAMING' ? (
          <span className="inline-flex items-center gap-2 text-muted-foreground">
            <span aria-hidden className="flex gap-1">
              <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-current" />
            </span>
            Searching your documents…
          </span>
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
                      className="mx-0.5 inline-flex size-[1.15rem] -translate-y-1.5 items-center justify-center rounded-full bg-signal-soft text-[0.65rem] font-semibold text-signal no-underline transition-colors hover:bg-signal hover:text-white"
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
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground">
            {turn.status === 'STREAMING' ? 'Reading' : 'Sources'}
          </p>
          <ol className="grid gap-2 sm:grid-cols-2" data-testid="ask-sources">
            {shown.map((source) => (
              <li key={source.index}>
                <Link
                  href={`/documents/${source.documentId}`}
                  className="flex h-full items-start gap-2.5 rounded-xl border bg-card px-3 py-2.5 transition-colors hover:border-foreground/20"
                >
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-signal text-[11px] font-semibold text-white tabular-nums">
                    {source.index}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{source.documentTitle}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[source.section, source.page ? `page ${source.page}` : null, `v${source.version}`]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}

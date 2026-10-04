'use client';

import { FileText, Search as SearchIcon, SearchX, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useActionState, useEffect, useRef } from 'react';

import { searchAction, type SearchState } from '@/app/(app)/search/actions';
import { EmptyState } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

import { Highlight, highlightTerms } from './highlight';

export function SearchView({ initialQuery = '' }: { initialQuery?: string }) {
  const [state, action, pending] = useActionState<SearchState, FormData>(searchAction, { query: '' });
  const form = useRef<HTMLFormElement>(null);

  // Arriving from the quick search (/search?q=…): run that search straight away.
  useEffect(() => {
    if (initialQuery) form.current?.requestSubmit();
  }, [initialQuery]);
  const terms = highlightTerms(state.query);

  return (
    <div className="flex flex-col gap-6">
      <form ref={form} role="search" action={action} className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="search-query" className="sr-only">
          Search documents
        </label>
        <div className="relative flex-1">
          <SearchIcon
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id="search-query"
            name="q"
            type="search"
            defaultValue={state.query || initialQuery}
            placeholder="Ask a question or search for a term, e.g. “how do we roll back a release?”"
            maxLength={500}
            autoFocus
            className="h-11 pl-10 text-[15px]"
          />
        </div>
        <Button type="submit" disabled={pending} size="lg" className="sm:w-32">
          {pending ? 'Searching…' : 'Search'}
        </Button>
      </form>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      {!state.results && !state.error && !pending ? (
        <EmptyState icon={Sparkles} title="Search everything you’re cleared to read">
          Type words you remember, or a whole question: KnowGuard matches exact terms and meaning, and only
          ever looks inside documents you may open.
        </EmptyState>
      ) : null}

      {state.results && state.results.length === 0 ? (
        <EmptyState icon={SearchX} title="No matches">
          <span data-testid="no-results">No documents you can read match “{state.query}”.</span> Try fewer or
          different words.
        </EmptyState>
      ) : null}

      {state.results && state.results.length > 0 ? (
        <ol className="flex flex-col gap-3" data-testid="search-results" aria-busy={pending}>
          <li className="text-sm text-muted-foreground" aria-live="polite">
            {state.results.length} {state.results.length === 1 ? 'passage' : 'passages'} from documents you
            can read
          </li>
          {state.results.map((result) => (
            <li key={result.chunkId}>
              <Card className="gap-2 py-4 transition-colors hover:border-foreground/20">
                <CardContent className="flex flex-col gap-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link
                      href={`/documents/${result.documentId}`}
                      className="flex items-center gap-2.5 font-medium underline-offset-4 hover:underline"
                    >
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-signal-soft">
                        <FileText className="size-4 text-signal" aria-hidden />
                      </span>
                      {result.title}
                    </Link>
                    <Badge variant="info" className="tabular-nums" title="Relevance">
                      {Math.round(result.score * 100)}% match
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {[result.section, result.page ? `page ${result.page}` : null, `v${result.version}`]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  <p className="text-sm leading-relaxed" data-testid="search-snippet">
                    <Highlight text={result.snippet} terms={terms} />
                  </p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

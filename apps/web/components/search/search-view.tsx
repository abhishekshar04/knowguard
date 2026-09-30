'use client';

import { FileText, Search as SearchIcon } from 'lucide-react';
import Link from 'next/link';
import { useActionState } from 'react';

import { searchAction, type SearchState } from '@/app/(app)/search/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

import { Highlight, highlightTerms } from './highlight';

export function SearchView() {
  const [state, action, pending] = useActionState<SearchState, FormData>(searchAction, { query: '' });
  const terms = highlightTerms(state.query);

  return (
    <div className="flex flex-col gap-6">
      <form role="search" action={action} className="flex gap-2">
        <label htmlFor="search-query" className="sr-only">
          Search documents
        </label>
        <Input
          id="search-query"
          name="q"
          type="search"
          defaultValue={state.query}
          placeholder="Ask a question or search for a term, e.g. “how do we roll back a release?”"
          maxLength={500}
          autoFocus
        />
        <Button type="submit" disabled={pending}>
          <SearchIcon aria-hidden />
          {pending ? 'Searching…' : 'Search'}
        </Button>
      </form>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      {state.results && state.results.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="no-results">
          No documents you can read match “{state.query}”.
        </p>
      ) : null}

      {state.results && state.results.length > 0 ? (
        <ol className="flex flex-col gap-3" data-testid="search-results" aria-busy={pending}>
          {state.results.map((result) => (
            <li key={result.chunkId}>
              <Card className="gap-2 py-4">
                <CardContent className="flex flex-col gap-1.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <Link
                      href={`/documents/${result.documentId}`}
                      className="flex items-center gap-2 font-medium hover:underline"
                    >
                      <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      {result.title}
                    </Link>
                    <span className="text-xs tabular-nums text-muted-foreground" title="Relevance">
                      {Math.round(result.score * 100)}% match
                    </span>
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

'use server';

import type { SearchResult } from '@knowguard/types';

import { ApiError, apiRequest } from '@/lib/api';
import { getSessionToken } from '@/lib/session';

export interface SearchState {
  query: string;
  results?: SearchResult[];
  error?: string;
}

/**
 * Runs a search through the BFF. A server action (POST) rather than a GET form so queries —
 * which can be sensitive — never appear in URLs, browser history or access logs.
 */
export async function searchAction(_prev: SearchState, form: FormData): Promise<SearchState> {
  const raw = form.get('q');
  const query = typeof raw === 'string' ? raw.trim().slice(0, 500) : '';
  if (!query) return { query };

  const token = await getSessionToken();
  if (!token) return { query, error: 'Your session has ended. Please sign in again.' };
  try {
    const { results } = await apiRequest<{ results: SearchResult[] }>('/search', {
      method: 'POST',
      token,
      body: { query, limit: 20 },
    });
    return { query, results };
  } catch (error) {
    if (error instanceof ApiError && error.code === 'RATE_LIMITED') {
      return { query, error: 'You are searching too quickly. Please wait a moment and try again.' };
    }
    if (error instanceof ApiError && error.status < 500) return { query, error: error.message };
    return { query, error: 'Search is temporarily unavailable. Please try again shortly.' };
  }
}

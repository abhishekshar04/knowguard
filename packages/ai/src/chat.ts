/**
 * Provider-neutral chat contract (spec §34: keep provider-specific code isolated). The RAG
 * service depends only on this; vendors are adapters in this package.
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  maxOutputTokens: number;
  /** Aborts the upstream request (e.g. the user closed the tab). */
  signal?: AbortSignal;
}

export interface ChatUsage {
  promptTokens: number;
  outputTokens: number;
}

export type ChatStreamEvent =
  { type: 'delta'; text: string } | { type: 'done'; usage: ChatUsage | null; finishReason: string | null };

export interface ChatProvider {
  readonly model: string;
  stream(request: ChatRequest): AsyncIterable<ChatStreamEvent>;
}

export type ChatErrorKind = 'rate_limited' | 'quota_exceeded' | 'unauthorized' | 'unavailable' | 'rejected';

/** Normalised provider failure; `message` is safe to show users, details go to logs. */
export class ChatProviderError extends Error {
  constructor(
    readonly kind: ChatErrorKind,
    message: string,
    readonly retryAfterSeconds?: number,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'ChatProviderError';
  }
}

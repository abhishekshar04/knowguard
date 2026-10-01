import OpenAI, { APIError } from 'openai';

import { type ChatProvider, ChatProviderError, type ChatRequest, type ChatStreamEvent } from './chat';

export interface OpenAIChatConfig {
  apiKey: string;
  model: string;
  /** For Azure/OpenAI-compatible servers (vLLM, LM Studio, gateways). */
  baseURL?: string;
  timeoutMs?: number;
}

/**
 * OpenAI Chat Completions adapter (the only file that imports the OpenAI SDK).
 * Uses `max_completion_tokens` (required by reasoning models, accepted by others) and leaves
 * temperature at the model default, which some models do not allow changing.
 */
export class OpenAIChatProvider implements ChatProvider {
  readonly model: string;
  private readonly client: OpenAI;

  constructor(config: OpenAIChatConfig) {
    this.model = config.model;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      ...(config.baseURL ? { baseURL: config.baseURL } : {}),
      timeout: config.timeoutMs ?? 60_000,
      maxRetries: 1,
    });
  }

  async *stream(request: ChatRequest): AsyncIterable<ChatStreamEvent> {
    let stream;
    try {
      stream = await this.client.chat.completions.create(
        {
          model: this.model,
          messages: request.messages,
          max_completion_tokens: request.maxOutputTokens,
          stream: true,
          stream_options: { include_usage: true },
        },
        { ...(request.signal ? { signal: request.signal } : {}) },
      );
    } catch (error) {
      throw toChatError(error);
    }

    let finishReason: string | null = null;
    let usage: { promptTokens: number; outputTokens: number } | null = null;
    try {
      for await (const chunk of stream) {
        const choice = chunk.choices[0];
        const text = choice?.delta?.content;
        if (text) yield { type: 'delta', text };
        if (choice?.finish_reason) finishReason = choice.finish_reason;
        if (chunk.usage) {
          usage = { promptTokens: chunk.usage.prompt_tokens, outputTokens: chunk.usage.completion_tokens };
        }
      }
    } catch (error) {
      throw toChatError(error);
    }
    yield { type: 'done', usage, finishReason };
  }
}

function toChatError(error: unknown): ChatProviderError {
  if (error instanceof ChatProviderError) return error;
  if (error instanceof APIError) {
    const retryAfter = Number(error.headers?.get?.('retry-after'));
    const retryAfterSeconds = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined;
    if (error.status === 429) {
      const quota = error.code === 'insufficient_quota';
      return new ChatProviderError(
        quota ? 'quota_exceeded' : 'rate_limited',
        quota
          ? 'The AI provider quota is exhausted. Ask an administrator to check the AI plan.'
          : 'The AI assistant is busy right now. Please try again in a moment.',
        retryAfterSeconds,
        { cause: error },
      );
    }
    if (error.status === 401 || error.status === 403) {
      return new ChatProviderError(
        'unauthorized',
        'The AI assistant is not configured correctly.',
        undefined,
        {
          cause: error,
        },
      );
    }
    if (error.status && error.status >= 400 && error.status < 500) {
      return new ChatProviderError('rejected', 'The AI provider rejected the request.', undefined, {
        cause: error,
      });
    }
  }
  return new ChatProviderError('unavailable', 'The AI assistant is temporarily unavailable.', undefined, {
    cause: error,
  });
}

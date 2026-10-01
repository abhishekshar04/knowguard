import type { ChatProvider, ChatProviderError, ChatRequest, ChatStreamEvent } from './chat';

/**
 * Deterministic provider for tests and local development without an API key.
 *
 * It records every request, so tests can assert exactly what would have been sent to a real
 * model — the basis of the "no unauthorized chunk ever reaches the LLM" checks. By default it
 * answers by citing the first source.
 */
export class FakeChatProvider implements ChatProvider {
  readonly model = 'test/fake-chat';
  readonly requests: ChatRequest[] = [];
  /** When set, the next streams fail with this error after `afterDeltas` deltas. */
  failure: { error: ChatProviderError; afterDeltas: number } | null = null;
  /** Pause before each delta, to simulate a slow model (e.g. to test client disconnects). */
  delayMs = 0;

  constructor(
    public reply: (request: ChatRequest) => string = () => 'According to the documents, see [1].',
  ) {}

  async *stream(request: ChatRequest): AsyncIterable<ChatStreamEvent> {
    this.requests.push(request);
    const text = this.reply(request);
    let sent = 0;
    // Stream word by word, like a real model.
    for (const piece of text.match(/\S+\s*/g) ?? []) {
      if (this.failure && sent >= this.failure.afterDeltas) throw this.failure.error;
      if (this.delayMs > 0) await new Promise((resolve) => setTimeout(resolve, this.delayMs));
      request.signal?.throwIfAborted();
      yield { type: 'delta', text: piece };
      sent += 1;
    }
    if (this.failure) throw this.failure.error;
    yield {
      type: 'done',
      usage: {
        promptTokens: request.messages.reduce((n, m) => n + Math.ceil(m.content.length / 4), 0),
        outputTokens: Math.ceil(text.length / 4),
      },
      finishReason: 'stop',
    };
  }

  /** Forgets recorded requests and restores default behaviour. */
  reset(): void {
    this.requests.length = 0;
    this.failure = null;
    this.delayMs = 0;
    this.reply = () => 'According to the documents, see [1].';
  }

  /** Everything that would have been sent to a model, as one string (for assertions). */
  get sentText(): string {
    return this.requests.flatMap((r) => r.messages.map((m) => m.content)).join('\n');
  }
}

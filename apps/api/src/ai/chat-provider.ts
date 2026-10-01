import { Logger, type Provider } from '@nestjs/common';
import { type ChatProvider, FakeChatProvider, OpenAIChatProvider } from '@knowguard/ai';

import { API_ENV, type ApiEnv } from '../config/api-env';

/** DI token for the answer-generation provider; `null` when Ask AI is not configured. */
export const CHAT_PROVIDER = Symbol('CHAT_PROVIDER');

export function createChatProvider(env: ApiEnv): ChatProvider | null {
  const kind = env.AI_PROVIDER ?? (env.OPENAI_API_KEY ? 'openai' : 'none');
  switch (kind) {
    case 'openai':
      if (!env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is required when AI_PROVIDER=openai');
      return new OpenAIChatProvider({
        apiKey: env.OPENAI_API_KEY,
        model: env.OPENAI_MODEL,
        ...(env.OPENAI_BASE_URL ? { baseURL: env.OPENAI_BASE_URL } : {}),
      });
    case 'fake':
      // Explicit opt-in only (never a default): used by automated tests, including browser tests
      // that run the built API in production mode.
      new Logger('ChatProvider').warn('AI_PROVIDER=fake: answers are canned test output, not a real model');
      return new FakeChatProvider();
    case 'none':
      return null;
  }
}

export const chatProviderProvider: Provider = {
  provide: CHAT_PROVIDER,
  inject: [API_ENV],
  useFactory: createChatProvider,
};

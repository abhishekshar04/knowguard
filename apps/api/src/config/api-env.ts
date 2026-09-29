import type { ApiEnv } from '@knowguard/validation';

/** DI token for the validated, immutable API configuration. */
export const API_ENV = Symbol('API_ENV');

export type { ApiEnv };

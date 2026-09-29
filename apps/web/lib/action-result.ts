import { ApiError } from './api';

/** Uniform result for admin server actions, rendered by <ActionForm>. */
export interface ActionResult {
  ok?: boolean;
  error?: string;
  message?: string;
  /** Set by the invite actions: the one-time link to show the admin. */
  inviteUrl?: string;
}

/** API messages are written to be client-safe; anything else becomes a generic message. */
export function errorResult(error: unknown): ActionResult {
  if (error instanceof ApiError) {
    if (error.code === 'VALIDATION_FAILED' && error.details[0]) {
      const { path, message } = error.details[0];
      return { error: `${path === '(body)' ? 'Input' : path} ${message}` };
    }
    if (error.status === 401) return { error: 'Your session has ended. Please sign in again.' };
    if (error.status < 500) return { error: error.message };
    if (error.status === 503)
      return { error: 'KnowGuard is temporarily unavailable. Please try again shortly.' };
  }
  return { error: 'Something went wrong. Please try again.' };
}

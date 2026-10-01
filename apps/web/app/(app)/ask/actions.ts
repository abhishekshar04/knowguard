'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { type ActionResult, errorResult } from '@/lib/action-result';
import { apiRequest } from '@/lib/api';
import { getSessionToken } from '@/lib/session';

/** Deletes one of the caller's conversations; the API returns 404 for anyone else's. */
export async function deleteConversationAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const token = await getSessionToken();
  if (!token) return { error: 'Your session has ended. Please sign in again.' };
  const id = form.get('conversationId');
  if (typeof id !== 'string' || !id) return { error: 'Conversation not found.' };
  try {
    await apiRequest(`/ai/conversations/${encodeURIComponent(id)}`, { method: 'DELETE', token });
  } catch (error) {
    return errorResult(error);
  }
  revalidatePath('/ask');
  redirect('/ask');
}

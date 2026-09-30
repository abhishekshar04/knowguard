'use server';

import type { DocumentDetails } from '@knowguard/types';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { type ActionResult, errorResult } from '@/lib/action-result';
import { apiRequest, apiUpload } from '@/lib/api';
import { getSessionToken } from '@/lib/session';

/*
 * Document server actions (BFF). They forward to the API with the caller's session; the API
 * runs the authorization engine for every operation. Form values are untrusted input.
 */

const SESSION_ENDED: ActionResult = { error: 'Your session has ended. Please sign in again.' };

function field(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

const segment = (value: string) => encodeURIComponent(value);

function documentPath(form: FormData): string {
  return `/documents/${segment(field(form, 'documentId'))}`;
}

function audienceIds(form: FormData): string[] {
  return form
    .getAll('audienceIds')
    .filter((value): value is string => typeof value === 'string' && value !== '');
}

/** Upload: rebuilds the multipart body from known fields only (nothing else is forwarded). */
export async function uploadDocumentAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const token = await getSessionToken();
  if (!token) return SESSION_ENDED;
  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) return { error: 'Choose a file to upload.' };

  const outgoing = new FormData();
  outgoing.set('file', file, file.name);
  outgoing.set('title', field(form, 'title') || file.name);
  outgoing.set('visibility', field(form, 'visibility') || 'PRIVATE');
  const description = field(form, 'description');
  if (description) outgoing.set('description', description);
  for (const id of audienceIds(form)) outgoing.append('audienceIds', id);

  let created: DocumentDetails;
  try {
    created = await apiUpload<DocumentDetails>('/documents', outgoing, token);
  } catch (error) {
    return errorResult(error);
  }
  revalidatePath('/documents');
  redirect(`/documents/${created.id}`);
}

export async function uploadVersionAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const token = await getSessionToken();
  if (!token) return SESSION_ENDED;
  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) return { error: 'Choose a file to upload.' };
  const outgoing = new FormData();
  outgoing.set('file', file, file.name);
  try {
    await apiUpload(`${documentPath(form)}/versions`, outgoing, token);
  } catch (error) {
    return errorResult(error);
  }
  revalidatePath(documentPath(form));
  revalidatePath('/documents');
  return { ok: true, message: 'New version uploaded. It will be processed for search shortly.' };
}

async function send(
  form: FormData,
  method: 'PATCH' | 'PUT' | 'DELETE',
  suffix: string,
  body: unknown,
  message: string,
): Promise<ActionResult> {
  const token = await getSessionToken();
  if (!token) return SESSION_ENDED;
  try {
    await apiRequest(`${documentPath(form)}${suffix}`, { method, token, body });
  } catch (error) {
    return errorResult(error);
  }
  revalidatePath(documentPath(form));
  revalidatePath('/documents');
  return { ok: true, message };
}

export async function updateDocumentAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  return send(
    form,
    'PATCH',
    '',
    { title: field(form, 'title'), description: field(form, 'description') || null },
    'Saved.',
  );
}

export async function setVisibilityAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  return send(
    form,
    'PUT',
    '/visibility',
    { visibility: field(form, 'visibility'), audienceIds: audienceIds(form) },
    'Visibility updated.',
  );
}

export async function reindexDocumentAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const token = await getSessionToken();
  if (!token) return SESSION_ENDED;
  try {
    await apiRequest(`${documentPath(form)}/reindex`, { method: 'POST', token });
  } catch (error) {
    return errorResult(error);
  }
  revalidatePath(documentPath(form));
  return { ok: true, message: 'Indexing restarted.' };
}

export async function deleteDocumentAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const token = await getSessionToken();
  if (!token) return SESSION_ENDED;
  try {
    await apiRequest(documentPath(form), { method: 'DELETE', token });
  } catch (error) {
    return errorResult(error);
  }
  revalidatePath('/documents');
  redirect('/documents');
}

// ── ACL editing: read-modify-write of the whole list via PUT /documents/:id/permissions ──

type Entry = { subjectType: string; subjectId: string; permission: string; effect: string };

async function currentEntries(form: FormData, token: string): Promise<Entry[]> {
  const doc = await apiRequest<DocumentDetails>(documentPath(form), { token });
  return (doc.acl ?? []).map((entry) => ({
    subjectType: entry.subject.type,
    subjectId: entry.subject.id,
    permission: entry.permission,
    effect: entry.effect,
  }));
}

export async function addAclEntryAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const token = await getSessionToken();
  if (!token) return SESSION_ENDED;
  const [subjectType, subjectId] = field(form, 'subject').split(':');
  if (!subjectType || !subjectId) return { error: 'Choose who to share with.' };
  const added: Entry = {
    subjectType,
    subjectId,
    permission: field(form, 'permission'),
    effect: field(form, 'effect'),
  };
  try {
    // Replace an existing entry for the same subject + permission instead of duplicating it.
    const entries = (await currentEntries(form, token)).filter(
      (e) =>
        !(
          e.subjectType === added.subjectType &&
          e.subjectId === added.subjectId &&
          e.permission === added.permission
        ),
    );
    await apiRequest(`${documentPath(form)}/permissions`, {
      method: 'PUT',
      token,
      body: { entries: [...entries, added] },
    });
  } catch (error) {
    return errorResult(error);
  }
  revalidatePath(documentPath(form));
  return { ok: true, message: 'Access updated.' };
}

export async function removeAclEntryAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const token = await getSessionToken();
  if (!token) return SESSION_ENDED;
  const [subjectType, subjectId, permission] = field(form, 'entry').split(':');
  try {
    const entries = (await currentEntries(form, token)).filter(
      (e) => !(e.subjectType === subjectType && e.subjectId === subjectId && e.permission === permission),
    );
    await apiRequest(`${documentPath(form)}/permissions`, { method: 'PUT', token, body: { entries } });
  } catch (error) {
    return errorResult(error);
  }
  revalidatePath(documentPath(form));
  return { ok: true };
}

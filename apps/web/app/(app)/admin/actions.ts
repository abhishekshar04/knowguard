'use server';

import type { InvitationGrant, InviteMemberResponse } from '@knowguard/types';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';

import { type ActionResult, errorResult } from '@/lib/action-result';
import { apiRequest } from '@/lib/api';
import { getSessionToken } from '@/lib/session';

/*
 * Administration server actions. They only forward to the API with the caller's session;
 * the API performs every authorization check (RBAC + escalation rules + tenant scoping).
 * IDs arrive from hidden form fields and are untrusted — the API 404s anything outside the
 * caller's organization.
 */

function field(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

/** Path segments from the form are encoded so they can never alter the API route. */
const segment = (value: string) => encodeURIComponent(value);

async function call(
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body: unknown,
  revalidate: string[],
  message?: string,
): Promise<ActionResult> {
  const token = await getSessionToken();
  if (!token) return { error: 'Your session has ended. Please sign in again.' };
  try {
    await apiRequest(path, { method, body, token });
  } catch (error) {
    return errorResult(error);
  }
  for (const path of revalidate) revalidatePath(path);
  return { ok: true, message };
}

/** Absolute invite URL on THIS origin (Next.js has already verified Origin matches Host). */
async function inviteUrl(invitation: InvitationGrant): Promise<string> {
  const incoming = await headers();
  const origin = incoming.get('origin') ?? `http://${incoming.get('host') ?? 'localhost:3000'}`;
  return new URL(`/invite/${invitation.token}`, origin).toString();
}

// ── members ────────────────────────────────────────────────────────────────────────────

export async function inviteMemberAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const token = await getSessionToken();
  if (!token) return { error: 'Your session has ended. Please sign in again.' };
  try {
    const result = await apiRequest<InviteMemberResponse>('/users/invitations', {
      method: 'POST',
      token,
      body: { name: field(form, 'name'), email: field(form, 'email'), roleKey: field(form, 'roleKey') },
    });
    revalidatePath('/admin/users');
    return {
      ok: true,
      message: `Invitation created for ${result.member.email}. Share this link with them — it is shown only once and expires in 7 days.`,
      inviteUrl: await inviteUrl(result.invitation),
    };
  } catch (error) {
    return errorResult(error);
  }
}

export async function reissueInvitationAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const token = await getSessionToken();
  if (!token) return { error: 'Your session has ended. Please sign in again.' };
  try {
    const invitation = await apiRequest<InvitationGrant>(
      `/users/${segment(field(form, 'userId'))}/invitations`,
      { method: 'POST', token },
    );
    return {
      ok: true,
      message: 'New link created. The previous link no longer works.',
      inviteUrl: await inviteUrl(invitation),
    };
  } catch (error) {
    return errorResult(error);
  }
}

export async function suspendMemberAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  return call('POST', `/users/${segment(field(form, 'userId'))}/suspend`, undefined, ['/admin/users']);
}

export async function reactivateMemberAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  return call('POST', `/users/${segment(field(form, 'userId'))}/reactivate`, undefined, ['/admin/users']);
}

export async function setMemberRoleAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  return call(
    'PUT',
    `/users/${segment(field(form, 'userId'))}/roles`,
    { roleKeys: [field(form, 'roleKey')] },
    ['/admin/users'],
    'Role updated.',
  );
}

// ── organization ───────────────────────────────────────────────────────────────────────

export async function renameOrganizationAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const result = await call(
    'PATCH',
    '/organization',
    { name: field(form, 'name') },
    [],
    'Organization renamed.',
  );
  // The shared layout shows the organization name, so refresh everything under it.
  if (result.ok) revalidatePath('/', 'layout');
  return result;
}

// ── departments ────────────────────────────────────────────────────────────────────────

const STRUCTURE_PAGES = ['/admin/departments', '/admin/teams', '/teams', '/admin/users'];

export async function createDepartmentAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const description = field(form, 'description');
  return call(
    'POST',
    '/departments',
    { name: field(form, 'name'), ...(description ? { description } : {}) },
    STRUCTURE_PAGES,
    'Department created.',
  );
}

export async function renameDepartmentAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  return call(
    'PATCH',
    `/departments/${segment(field(form, 'departmentId'))}`,
    { name: field(form, 'name') },
    STRUCTURE_PAGES,
    'Saved.',
  );
}

export async function deleteDepartmentAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  return call('DELETE', `/departments/${segment(field(form, 'departmentId'))}`, undefined, STRUCTURE_PAGES);
}

export async function addDepartmentMemberAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  return call(
    'PUT',
    `/departments/${segment(field(form, 'departmentId'))}/members/${segment(field(form, 'userId'))}`,
    undefined,
    STRUCTURE_PAGES,
  );
}

export async function removeDepartmentMemberAction(
  _prev: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  return call(
    'DELETE',
    `/departments/${segment(field(form, 'departmentId'))}/members/${segment(field(form, 'userId'))}`,
    undefined,
    STRUCTURE_PAGES,
  );
}

// ── teams ──────────────────────────────────────────────────────────────────────────────

export async function createTeamAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  return call(
    'POST',
    '/teams',
    { name: field(form, 'name'), departmentId: field(form, 'departmentId') },
    STRUCTURE_PAGES,
    'Team created.',
  );
}

export async function renameTeamAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  return call(
    'PATCH',
    `/teams/${segment(field(form, 'teamId'))}`,
    { name: field(form, 'name') },
    STRUCTURE_PAGES,
    'Saved.',
  );
}

export async function deleteTeamAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  return call('DELETE', `/teams/${segment(field(form, 'teamId'))}`, undefined, STRUCTURE_PAGES);
}

export async function addTeamMemberAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  return call(
    'PUT',
    `/teams/${segment(field(form, 'teamId'))}/members/${segment(field(form, 'userId'))}`,
    undefined,
    STRUCTURE_PAGES,
  );
}

export async function removeTeamMemberAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  return call(
    'DELETE',
    `/teams/${segment(field(form, 'teamId'))}/members/${segment(field(form, 'userId'))}`,
    undefined,
    STRUCTURE_PAGES,
  );
}

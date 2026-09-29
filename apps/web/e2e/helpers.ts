import { randomBytes, randomUUID } from 'node:crypto';

import { expect, type Page } from '@playwright/test';

export const SESSION_COOKIE = '__Host-kg_session';
export const PASSWORD = 'correct horse battery staple';

export function uniqueEmail(label = 'pw'): string {
  return `${label}-${randomUUID().slice(0, 12)}@e2e.example`;
}

/**
 * Each test presents a distinct client IP (via X-Forwarded-For) so the API's per-IP
 * registration/login limits don't accumulate across tests and repeated local runs.
 */
export async function isolateClientIp(page: Page): Promise<void> {
  const [a, b, c] = randomBytes(3);
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `10.${a}.${b}.${c}` });
}

export async function registerViaUi(
  page: Page,
  input: { name?: string; email?: string; password?: string; organizationName?: string } = {},
) {
  const account = {
    name: input.name ?? 'Playwright User',
    email: input.email ?? uniqueEmail(),
    password: input.password ?? PASSWORD,
    organizationName: input.organizationName ?? `Org ${randomUUID().slice(0, 6)}`,
  };
  await page.goto('/register');
  await page.getByLabel('Your name').fill(account.name);
  await page.getByLabel('Work email').fill(account.email);
  await page.getByLabel('Password').fill(account.password);
  await page.getByLabel('Organization name').fill(account.organizationName);
  await page.getByRole('button', { name: 'Create organization' }).click();
  return account;
}

export async function loginViaUi(page: Page, email: string, password: string) {
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

export async function signOut(page: Page) {
  await page.getByRole('button', { name: 'Sign out' }).first().click();
  await expect(page).toHaveURL(/\/login$/);
}

import { expect, test } from './fixtures';

import { OFFLINE_WEB_PORT } from '../playwright.config';
import { loginViaUi, PASSWORD, registerViaUi, SESSION_COOKIE, uniqueEmail, isolateClientIp } from './helpers';

/** Host-only (no leading dot), path=/, Secure — the shape a real "__Host-" cookie has. */
const sessionCookie = (value: string) => ({
  name: SESSION_COOKIE,
  value,
  domain: 'localhost',
  path: '/',
  secure: true,
  httpOnly: true,
  sameSite: 'Lax' as const,
});

test.beforeEach(async ({ page }) => {
  await isolateClientIp(page);
});

test.describe('stale session cookies', () => {
  test('a dead cookie is cleared on the way to sign-in', async ({ page, context }) => {
    await context.addCookies([sessionCookie('x'.repeat(43))]);

    await page.goto('/dashboard');

    await expect(page).toHaveURL(/\/login$/);
    expect((await context.cookies()).find((c) => c.name === SESSION_COOKIE)).toBeUndefined();
    // With the cookie gone, the next visit is redirected by proxy.ts without an API round-trip.
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login\?next=%2Fdashboard$/);
  });

  test('the clearing endpoint never logs out a valid session (no cross-site logout)', async ({
    page,
    context,
  }) => {
    await registerViaUi(page);
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto('/auth/session-ended');

    await expect(page).toHaveURL(/\/dashboard$/);
    expect((await context.cookies()).find((c) => c.name === SESSION_COOKIE)).toBeDefined();
  });
});

test.describe('API unreachable', () => {
  const offline = `http://localhost:${OFFLINE_WEB_PORT}`;

  test('sign-in still renders with a leftover cookie, and explains the outage on submit', async ({
    page,
    context,
  }) => {
    await context.addCookies([sessionCookie('x'.repeat(43))]);

    const response = await page.goto(`${offline}/login`);

    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

    await loginViaUi(page, uniqueEmail('offline'), PASSWORD);
    await expect(page.getByTestId('form-error')).toHaveText(
      'KnowGuard is temporarily unavailable. Please try again shortly.',
    );
    // The cookie is not cleared: we could not confirm the session is dead.
    expect((await context.cookies(offline)).find((c) => c.name === SESSION_COOKIE)).toBeDefined();
  });

  test('registration page renders too', async ({ page }) => {
    const response = await page.goto(`${offline}/register`);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { name: 'Create your organization' })).toBeVisible();
  });
});

import { expect, test } from '@playwright/test';

import {
  loginViaUi,
  PASSWORD,
  registerViaUi,
  SESSION_COOKIE,
  signOut,
  uniqueEmail,
  isolateClientIp,
} from './helpers';

test.beforeEach(async ({ page }) => {
  await isolateClientIp(page);
});

test('protected pages redirect anonymous visitors to sign-in', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard$/);
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
});

test('register → owner dashboard → sign out → sign in', async ({ page, context }) => {
  const account = await registerViaUi(page, { name: 'Ada Lovelace', organizationName: 'Analytical Engines' });

  // Registration creates the organization and signs the user in as OWNER.
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Welcome, Ada Lovelace' })).toBeVisible();
  await expect(page.getByTestId('organization-name')).toHaveText('Analytical Engines');
  await expect(page.getByTestId('roles')).toHaveText('OWNER');
  await expect(page.getByText('Your email address is not verified.')).toBeVisible();

  // The session lives only in a Secure, HttpOnly, SameSite=Lax, host-only cookie.
  const cookie = (await context.cookies()).find((c) => c.name === SESSION_COOKIE);
  expect(cookie).toMatchObject({ httpOnly: true, secure: true, sameSite: 'Lax', path: '/' });
  expect(cookie?.value).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(await page.evaluate(() => document.cookie)).not.toContain('kg_session');

  await signOut(page);
  expect((await context.cookies()).find((c) => c.name === SESSION_COOKIE)).toBeUndefined();
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);

  await loginViaUi(page, account.email, account.password);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByTestId('organization-name')).toHaveText('Analytical Engines');
});

test('a session cookie copied before sign-out is useless afterwards', async ({ page, browser }) => {
  await registerViaUi(page);
  await expect(page).toHaveURL(/\/dashboard$/);
  const stolen = (await page.context().cookies()).find((c) => c.name === SESSION_COOKIE);
  expect(stolen).toBeDefined();

  await signOut(page);

  const attacker = await browser.newContext();
  await attacker.addCookies([stolen!]);
  const attackerPage = await attacker.newPage();
  await attackerPage.goto('/dashboard');
  await expect(attackerPage).toHaveURL(/\/login/);
  await attacker.close();
});

test('login failures are generic: wrong password and unknown email look identical', async ({ page }) => {
  const account = await registerViaUi(page);
  await expect(page).toHaveURL(/\/dashboard$/);
  await signOut(page);

  await loginViaUi(page, account.email, 'wrong password entirely');
  const alert = page.getByTestId('form-error');
  await expect(alert).toHaveText('Invalid email or password.');
  // The email is kept, the password is not.
  await expect(page.getByLabel('Email')).toHaveValue(account.email);
  await expect(page.getByLabel('Password')).toHaveValue('');

  await loginViaUi(page, uniqueEmail('ghost'), PASSWORD);
  await expect(alert).toHaveText('Invalid email or password.');
});

test('registration validates input and rejects a taken email', async ({ page }) => {
  await registerViaUi(page, { password: 'short' });
  await expect(page.getByText('Password must be at least 12 characters')).toBeVisible();
  await expect(page).toHaveURL(/\/register$/);

  const taken = await registerViaUi(page);
  await expect(page).toHaveURL(/\/dashboard$/);
  await signOut(page);

  await registerViaUi(page, { email: taken.email });
  await expect(page.getByText('This email address cannot be used to register.')).toBeVisible();
});

test('post-login redirect only allows same-origin paths', async ({ page }) => {
  const account = await registerViaUi(page);
  await expect(page).toHaveURL(/\/dashboard$/);
  await signOut(page);

  await page.goto('/login?next=//evil.example/phish');
  await loginViaUi(page, account.email, account.password);
  await expect(page).toHaveURL(/localhost:3100\/dashboard$/);
});

test('signed-in users are sent from auth pages to the dashboard', async ({ page }) => {
  await registerViaUi(page);
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto('/login');
  await expect(page).toHaveURL(/\/dashboard$/);
});

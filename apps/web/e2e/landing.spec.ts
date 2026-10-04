import { expect, test } from './fixtures';
import { isolateClientIp, registerViaUi } from './helpers';

/*
 * The public landing page. The fixture also fails these tests on any CSP violation or page
 * error — including from the WebGL archive scene, its shaders and smooth scrolling.
 */

test.beforeEach(async ({ page }) => {
  await isolateClientIp(page);
});

test('visitors get the story, the 3D archive and a working sign-up path', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(/\/$/); // public: no redirect to /login
  // Exact text, as a screen reader reads it (the animated lines must not run together).
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Knowledge, on a need-to-know basis.');
  await expect(page.getByTestId('archive-canvas').locator('canvas')).toBeAttached();

  for (const name of [
    'Everything your company has written down.',
    'Then everything you aren’t cleared for disappears.',
    'What’s left becomes an answer you can check.',
    'Built like a vault, tested like one.',
    'Five steps, one rule',
    'Built for teams who can’t afford a leak',
    'Questions, answered',
  ]) {
    await expect(page.getByRole('heading', { name })).toBeAttached();
  }

  await page.getByRole('link', { name: 'Create a workspace' }).first().click();
  await expect(page).toHaveURL(/\/register$/);
});

test('switching who is asking changes the answer, and both switches stay in sync', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); // answers appear at once
  await page.goto('/');
  const answer = page.getByTestId('answer-panel');
  const clearance = page.locator('#clearance');

  await expect(clearance.getByRole('radio', { name: /Sam/ })).toBeChecked();
  await expect(answer).toContainText('Nothing in the documents you can read mentions a review.');
  await expect(answer).toContainText('Never searched for Sam: Refund Fraud Review, Board Minutes Q3.');

  await clearance.getByRole('radio', { name: /Dana/ }).check();
  await expect(
    clearance.getByText('Dana can read about three quarters, including finance reviews.'),
  ).toBeVisible();
  await expect(answer.getByRole('radio', { name: /Dana/ })).toBeChecked();
  await expect(answer).toContainText('under review until 14 November');
  await expect(answer.getByRole('list', { name: 'Sources' })).toContainText('Refund Fraud Review, page 1');

  await answer.getByRole('radio', { name: /Sam/ }).check();
  await expect(clearance.getByRole('radio', { name: /Sam/ })).toBeChecked();
});

test('the person switch works from the keyboard', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const answer = page.getByTestId('answer-panel');
  const sam = answer.getByRole('radio', { name: /Sam/ });
  await sam.focus();
  await page.keyboard.press('ArrowRight');
  await expect(answer.getByRole('radio', { name: /Dana/ })).toBeChecked();
  await expect(answer).toContainText('under review');
  await page.keyboard.press('ArrowLeft');
  await expect(sam).toBeChecked();
});

test('on a phone: the menu works, nothing scrolls sideways, and the scene leaves before the content', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.locator('#mobile-menu').getByRole('link', { name: 'FAQ' }).click();
  await expect(page.getByRole('heading', { name: 'Questions, answered' })).toBeInViewport();
  await expect(page.getByTestId('archive-canvas')).toHaveCSS('opacity', '0');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('signed-in members get a shortcut into the app instead of sign-up', async ({ page }) => {
  await registerViaUi(page);
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Open KnowGuard' }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Create a workspace' })).toHaveCount(0);
});

test('sign-in pages share the public design: the form beside the live archive', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/login');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sign in');
  await expect(page.getByTestId('auth-visual').locator('canvas')).toBeAttached();
  await page.getByRole('link', { name: 'Create an organization' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Create your organization');

  // On a phone the archive stays out of the way: no canvas, only the form.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId('auth-visual').locator('canvas')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Create organization' })).toBeVisible();
});

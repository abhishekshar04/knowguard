import { expect, test } from './fixtures';
import { isolateClientIp, registerViaUi } from './helpers';

/* The signed-in shell: quick search from the top bar, and navigation on small screens. */

test.beforeEach(async ({ page }) => {
  await isolateClientIp(page);
});

test('quick search opens the search page with the query already run', async ({ page }) => {
  await registerViaUi(page);
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.keyboard.press('/'); // focuses the quick search from anywhere
  await expect(page.getByLabel('Quick search')).toBeFocused();
  await page.keyboard.type('refund policy');
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL(/\/search\?q=refund%20policy$/);
  await expect(page.getByLabel('Search documents')).toHaveValue('refund policy');
  await expect(page.getByText('No documents you can read match “refund policy”.')).toBeVisible();
});

test('on a phone, navigation lives in a drawer that closes after choosing a page', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await registerViaUi(page);
  await expect(page).toHaveURL(/\/dashboard$/);

  const drawer = page.getByRole('dialog', { name: 'Navigation' });
  await expect(drawer).toBeHidden();
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(drawer).toBeVisible();
  await drawer.getByRole('link', { name: 'Documents' }).first().click();

  await expect(page).toHaveURL(/\/documents$/);
  await expect(drawer).toBeHidden();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

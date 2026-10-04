import { expect, test } from './fixtures';
import { isolateClientIp, registerViaUi, uploadViaUi } from './helpers';

/**
 * Browser-level security regressions (ADR 0013). The fixture already fails any test whose pages
 * hit a CSP violation or an uncaught error; these tests check the policy itself and that
 * user-controlled text is never interpreted as HTML anywhere it is shown.
 */

test.beforeEach(async ({ page }) => {
  await isolateClientIp(page);
});

test('pages carry a strict, per-request Content-Security-Policy and hardening headers', async ({ page }) => {
  const first = await page.goto('/login');
  const second = await page.request.get('/login');
  const policy = first?.headers()['content-security-policy'] ?? '';
  const nonce = /'nonce-([^']+)'/.exec(policy)?.[1];

  expect(nonce).toBeTruthy();
  expect(second.headers()['content-security-policy']).not.toContain(nonce); // fresh every request
  expect(policy).toContain("script-src 'self' 'nonce-");
  expect(policy).toContain("'strict-dynamic'");
  expect(policy).not.toMatch(/script-src[^;]*'unsafe-(inline|eval)'/);
  for (const directive of [
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ]) {
    expect(policy).toContain(directive);
  }
  // Next.js applied the nonce to every script it renders (otherwise nothing would hydrate).
  // Chunks loaded later by those scripts (e.g. the 3D scene) are trusted via 'strict-dynamic'.
  const html = (await first?.text()) ?? '';
  const scripts = [...html.matchAll(/<script\b[^>]*>/g)].map((match) => match[0]);
  expect(scripts.length).toBeGreaterThan(0);
  expect(scripts.every((tag) => tag.includes(`nonce="${nonce}"`))).toBe(true);

  const headers = first?.headers() ?? {};
  expect(headers).toMatchObject({
    'x-frame-options': 'DENY',
    'x-content-type-options': 'nosniff',
    'cross-origin-opener-policy': 'same-origin',
    'referrer-policy': 'strict-origin-when-cross-origin',
  });
  expect(headers['strict-transport-security']).toContain('max-age=');
  expect(headers['x-powered-by']).toBeUndefined();
});

test('user-controlled text is shown as text everywhere, never run as HTML', async ({ page }) => {
  test.setTimeout(120_000);
  await registerViaUi(page, { organizationName: 'XSS Co' });
  await expect(page).toHaveURL(/\/dashboard$/);
  page.on('dialog', (dialog) => {
    throw new Error(`Unexpected dialog: ${dialog.message()}`);
  });

  const title = `<img src=x onerror="window.__xss=1">Payroll`;
  const body =
    '# Payroll <script>window.__xss=2</script>\n\n<svg onload="window.__xss=3">Salaries are paid monthly.</svg>';
  const docUrl = await uploadViaUi(page, {
    title,
    content: body,
    filename: 'payroll.md',
    visibility: 'Whole organization — Every member.',
  });
  await expect(page.getByTestId('document-status')).toHaveText('ready', { timeout: 60_000 });

  // Document page: heading and preview show the markup literally.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
  await expect(page.getByText('<script>window.__xss=2</script>', { exact: false })).toBeVisible();

  const visits: Array<[string, () => Promise<void>]> = [
    ['documents list', async () => void (await page.goto('/documents'))],
    ['admin documents', async () => void (await page.goto('/admin/documents'))],
    ['audit log', async () => void (await page.goto('/admin/audit'))],
    ['dashboard', async () => void (await page.goto('/dashboard'))],
    [
      'search results',
      async () => {
        await page.goto('/search');
        await page.getByLabel('Search documents').fill('salaries paid monthly');
        await page.getByRole('button', { name: 'Search' }).click();
        await expect(page.getByTestId('search-results')).toContainText('Payroll', { timeout: 30_000 });
      },
    ],
    [
      'Ask AI sources',
      async () => {
        await page.goto('/ask');
        await page.getByLabel('Your question').fill('When are salaries paid?');
        await page.getByRole('button', { name: 'Ask' }).click();
        await expect(page.getByTestId('ask-answer').last()).toHaveAttribute('data-status', 'COMPLETE', {
          timeout: 30_000,
        });
      },
    ],
  ];
  for (const [where, visit] of visits) {
    await visit();
    await expect(page.getByText(title, { exact: false }).first(), where).toBeVisible();
    expect(await page.evaluate(() => (window as { __xss?: number }).__xss), where).toBeUndefined();
    expect(await page.locator('img[src="x"], svg[onload]').count(), where).toBe(0);
  }

  // The raw file keeps its own sandboxed policy (not the page policy).
  const file = await page.request.get(`${new URL(docUrl).pathname}/file?inline=1`);
  expect(file.headers()['content-security-policy']).toMatch(/^sandbox; default-src 'none'/);
  expect(file.headers()['content-type']).toMatch(/^text\/markdown/);
});

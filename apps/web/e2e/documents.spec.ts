import { expect, test } from '@playwright/test';

import { inviteEmployee, isolateClientIp, registerViaUi, uploadViaUi } from './helpers';

test.beforeEach(async ({ page }) => {
  await isolateClientIp(page);
});

test('upload, preview, download, and organization-wide reading', async ({ page, browser }) => {
  await registerViaUi(page, { organizationName: 'Docs Co' });
  await expect(page).toHaveURL(/\/dashboard$/);
  const reader = await inviteEmployee(page, browser, 'Rita Reader');

  const content = `# Deploy guide\n\nRun the pipeline. ${Date.now()}`;
  const url = await uploadViaUi(page, {
    title: 'Deploy Guide',
    content,
    filename: 'deploy.md',
    visibility: 'Whole organization — Every member.',
  });
  await expect(page.getByTestId('document-preview')).toContainText('Run the pipeline.');
  // The worker indexes it in the background; the page refreshes itself until it is ready.
  await expect(page.getByTestId('document-status')).toHaveText('ready', { timeout: 60_000 });
  await expect(page.getByTestId('indexing-detail')).toContainText('passage');
  await expect(page.getByTestId('versions')).toContainText('deploy.md');

  // Download goes through the BFF with the session cookie and returns the exact bytes.
  const download = await page.request.get(`${url}/file`);
  expect(download.status()).toBe(200);
  expect(download.headers()['content-disposition']).toContain('attachment');
  expect(download.headers()['x-content-type-options']).toBe('nosniff');
  expect(await download.text()).toBe(content);

  // A member reads it; they get no editing or sharing controls.
  await reader.page.goto('/documents');
  await reader.page.getByRole('link', { name: 'Deploy Guide' }).click();
  await expect(reader.page.getByTestId('document-preview')).toContainText('Run the pipeline.');
  await expect(reader.page.getByTestId('sharing')).toHaveCount(0);
  await expect(reader.page.getByRole('button', { name: 'Upload new version' })).toHaveCount(0);
  await reader.context.close();
});

test('private documents stay hidden until shared, and a deny revokes access', async ({ page, browser }) => {
  await registerViaUi(page, { organizationName: 'Private Co' });
  await expect(page).toHaveURL(/\/dashboard$/);
  const reader = await inviteEmployee(page, browser, 'Pat Private');

  const url = await uploadViaUi(page, {
    title: 'Salary Bands',
    content: 'Confidential compensation data',
    filename: 'salaries.md',
    visibility: 'Private — Only you.',
  });

  // Not listed, and the direct URL is a plain 404 — the title never leaks.
  await reader.page.goto('/documents');
  await expect(reader.page.getByTestId('document-row-Salary Bands')).toHaveCount(0);
  const direct = await reader.page.goto(url);
  expect(direct?.status()).toBe(404);
  await expect(reader.page.getByText('Salary Bands')).toHaveCount(0);
  const file = await reader.page.request.get(`${url}/file`);
  expect(file.status()).toBe(404);

  // Owner switches to "Specific people" and grants read access to the reader.
  await page
    .getByTestId('sharing')
    .getByLabel('Who can read it')
    .selectOption({ label: 'Specific people — Only those you share with explicitly.' });
  await page.getByRole('button', { name: 'Save visibility' }).click();
  await expect(page.getByTestId('document-visibility')).toHaveText('Specific people');
  await page.getByLabel('Share with').selectOption({ label: `Pat Private (${reader.email})` });
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByTestId('acl-entries')).toContainText('Pat Private');

  await reader.page.goto(url);
  await expect(reader.page.getByTestId('document-preview')).toContainText('Confidential compensation data');

  // Replace the grant with an explicit deny: access is gone again.
  await page.getByLabel('Share with').selectOption({ label: `Pat Private (${reader.email})` });
  await page.getByLabel('Effect').selectOption('DENY');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByTestId('acl-entries')).toContainText('deny read');
  const denied = await reader.page.goto(url);
  expect(denied?.status()).toBe(404);
  await reader.context.close();
});

test('unsupported files are rejected with a clear message', async ({ page }) => {
  await registerViaUi(page, { organizationName: 'Reject Co' });
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto('/documents');
  await page.setInputFiles('#upload-file', {
    name: 'invoice.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]),
  });
  await page.getByRole('button', { name: 'Upload' }).click();
  await expect(page.getByTestId('action-error')).toHaveText(
    'Only PDF, Word (.docx), Markdown and plain-text files are supported.',
  );
});

test('a document that cannot be read ends up FAILED with a reason and a retry button', async ({ page }) => {
  await registerViaUi(page, { organizationName: 'Broken Co' });
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto('/documents');
  // Passes the upload signature check, but is not a readable PDF.
  await page.setInputFiles('#upload-file', {
    name: 'broken.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.7\nthis is not really a pdf'),
  });
  await page.getByLabel('Title').fill('Broken PDF');
  await page.getByRole('button', { name: 'Upload' }).click();
  await expect(page).toHaveURL(/\/documents\/[0-9a-f-]{36}$/);

  await expect(page.getByTestId('document-status')).toHaveText('failed', { timeout: 60_000 });
  await expect(page.getByTestId('indexing-detail')).toHaveText(
    'The PDF could not be read. It may be corrupt or password-protected.',
  );
  await expect(page.getByRole('button', { name: 'Retry indexing' })).toBeVisible();
});

test('search finds indexed documents the user may read — and nothing else', async ({ page, browser }) => {
  await registerViaUi(page, { organizationName: 'Search Co' });
  await expect(page).toHaveURL(/\/dashboard$/);
  const reader = await inviteEmployee(page, browser, 'Sam Searcher');

  const shared = await uploadViaUi(page, {
    title: 'Incident Handbook',
    content:
      '# Incidents\n\nIf a payments release fails its smoke tests, revert it from the pipeline dashboard.',
    filename: 'incidents.md',
    visibility: 'Whole organization — Every member.',
  });
  await expect(page.getByTestId('document-status')).toHaveText('ready', { timeout: 60_000 });
  await uploadViaUi(page, {
    title: 'Board Minutes',
    content: '# Minutes\n\nThe board discussed reverting the payments pipeline release policy.',
    filename: 'minutes.md',
    visibility: 'Private — Only you.',
  });
  await expect(page.getByTestId('document-status')).toHaveText('ready', { timeout: 60_000 });

  await reader.page.goto('/search');
  await reader.page.getByLabel('Search documents').fill('how do I revert a failed payments release');
  await reader.page.getByRole('button', { name: 'Search' }).click();
  const results = reader.page.getByTestId('search-results');
  await expect(results).toContainText('Incident Handbook', { timeout: 30_000 });
  await expect(results).not.toContainText('Board Minutes'); // private to the owner
  await expect(results.locator('mark').first()).toBeVisible(); // query terms highlighted
  // Queries stay out of the URL.
  expect(reader.page.url()).not.toContain('revert');

  await results.getByRole('link', { name: 'Incident Handbook' }).click();
  await expect(reader.page).toHaveURL(shared);
  await reader.context.close();
});

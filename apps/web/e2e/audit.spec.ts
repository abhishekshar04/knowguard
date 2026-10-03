import { expect, test } from '@playwright/test';

import { inviteEmployee, isolateClientIp, registerViaUi, uploadViaUi } from './helpers';

test.beforeEach(async ({ page }) => {
  await isolateClientIp(page);
});

test('admins review audit logs, analytics and documents; members cannot', async ({ page, browser }) => {
  test.setTimeout(90_000);
  await registerViaUi(page, { organizationName: 'Audit Co' });
  await expect(page).toHaveURL(/\/dashboard$/);
  const member = await inviteEmployee(page, browser, 'Morgan Member');

  const docUrl = await uploadViaUi(page, {
    title: 'Quarterly Report',
    content: '# Q3\n\nRevenue grew.',
    filename: 'q3.md',
    visibility: 'Whole organization — Every member.',
  });
  await uploadViaUi(page, {
    title: 'Private Salaries',
    content: '# Salaries\n\nConfidential.',
    filename: 'salaries.md',
    visibility: 'Private — Only you.',
  });

  // The member opens the shared document and probes the private one.
  await member.page.goto(docUrl);
  await expect(member.page.getByRole('heading', { name: 'Quarterly Report' })).toBeVisible();

  // Audit log: newest first, filterable, with readable descriptions.
  await page.goto('/admin/audit');
  const table = page.getByTestId('audit-table');
  await expect(table).toContainText('Uploaded document');
  await expect(table).toContainText('Viewed document');
  await expect(table).toContainText('Morgan Member');
  await expect(table).toContainText('Document “Quarterly Report”');
  await page.getByLabel('Event').selectOption({ label: 'Uploaded document' });
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page).toHaveURL(/action=DOCUMENT_CREATE/);
  const rows = page.getByTestId('audit-row');
  await expect(rows).toHaveCount(2);
  await expect(table).not.toContainText('Viewed document');

  // Analytics: summary tiles, one chart per metric, and a table view.
  await page.goto('/admin/analytics?days=7');
  await expect(page.getByTestId('analytics-summary')).toContainText('Documents');
  await expect(page.getByTestId('chart-uploads')).toContainText('2 total');
  await page.getByText('Show as a table').click();
  await expect(page.getByTestId('activity-table')).toBeVisible();
  await expect(page.getByTestId('top-documents')).toContainText('Quarterly Report');

  // Document administration with filters.
  await page.goto('/admin/documents');
  await expect(page.getByTestId('admin-documents')).toContainText('Private Salaries');
  await page.getByLabel('Title').fill('quarterly');
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByTestId('documents-total')).toHaveText('1 document');

  // Members have none of this.
  await expect(member.page.getByRole('link', { name: 'Audit Logs' })).toHaveCount(0);
  await member.page.goto('/admin/audit');
  await expect(member.page.getByTestId('access-denied')).toBeVisible();
  await member.page.goto('/admin/analytics');
  await expect(member.page.getByTestId('access-denied')).toBeVisible();
  await member.context.close();
});

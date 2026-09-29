import { type Browser, expect, type Page, test } from '@playwright/test';

import { PASSWORD, registerViaUi, uniqueEmail, isolateClientIp } from './helpers';

test.beforeEach(async ({ page }) => {
  await isolateClientIp(page);
});

/** Owner invites someone through the Users page and returns the one-time link shown. */
async function inviteViaUi(
  page: Page,
  input: { name: string; email: string; role: string },
): Promise<string> {
  await page.goto('/admin/users');
  await page.getByLabel('Name', { exact: true }).fill(input.name);
  await page.getByLabel('Email', { exact: true }).fill(input.email);
  await page.getByLabel('Role', { exact: true }).selectOption({ label: input.role });
  await page.getByRole('button', { name: 'Create invitation' }).click();
  const link = page.getByTestId('invite-url');
  await expect(link).toBeVisible();
  return link.inputValue();
}

/** Opens an invite link in a fresh browser (no shared cookies) and joins. */
async function acceptInFreshBrowser(browser: Browser, inviteUrl: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await isolateClientIp(page);
  await page.goto(inviteUrl);
  await page.getByLabel('Choose a password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Join organization' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  return { context, page };
}

test('owner invites a member who joins with their own password and gets only employee access', async ({
  page,
  browser,
}) => {
  await registerViaUi(page, { organizationName: 'Invite Co' });
  await expect(page).toHaveURL(/\/dashboard$/);

  const email = uniqueEmail('invitee');
  const inviteUrl = await inviteViaUi(page, { name: 'Ivy Invitee', email, role: 'Employee' });
  expect(inviteUrl).toMatch(/\/invite\/[A-Za-z0-9_-]{43}$/);
  await expect(page.getByTestId(`member-${email}`).getByTestId('member-status')).toHaveText('invited');

  const invitee = await acceptInFreshBrowser(browser, inviteUrl);
  await expect(invitee.page.getByTestId('organization-name')).toHaveText('Invite Co');
  await expect(invitee.page.getByTestId('roles')).toHaveText('EMPLOYEE');
  // Employees get no admin navigation and no invite form.
  await expect(invitee.page.getByRole('navigation', { name: 'Main' }).first().getByText('Admin')).toHaveCount(
    0,
  );
  await invitee.page.goto('/admin/users');
  await expect(invitee.page.getByRole('button', { name: 'Create invitation' })).toHaveCount(0);

  // The link is single-use.
  const reuse = await browser.newPage();
  await reuse.goto(inviteUrl);
  await expect(reuse.getByTestId('invitation-invalid')).toBeVisible();
  await reuse.close();

  // Owner sees them as active now.
  await page.reload();
  await expect(page.getByTestId(`member-${email}`).getByTestId('member-status')).toHaveText('active');
  await invitee.context.close();
});

test('suspending a member signs them out on their next request', async ({ page, browser }) => {
  await registerViaUi(page, { organizationName: 'Suspend Co' });
  await expect(page).toHaveURL(/\/dashboard$/);
  const email = uniqueEmail('suspendee');
  const inviteUrl = await inviteViaUi(page, { name: 'Sam Suspendee', email, role: 'Employee' });
  const member = await acceptInFreshBrowser(browser, inviteUrl);

  await page.reload();
  const row = page.getByTestId(`member-${email}`);
  await row.getByRole('button', { name: 'Suspend' }).click();
  await expect(row.getByTestId('member-status')).toHaveText('suspended');

  await member.page.reload();
  await expect(member.page).toHaveURL(/\/login$/);

  await row.getByRole('button', { name: 'Reactivate' }).click();
  await expect(row.getByTestId('member-status')).toHaveText('active');
  await member.context.close();
});

test('an admin cannot hand out the owner role', async ({ page, browser }) => {
  await registerViaUi(page, { organizationName: 'Escalation Co' });
  await expect(page).toHaveURL(/\/dashboard$/);
  const inviteUrl = await inviteViaUi(page, {
    name: 'Ada Admin',
    email: uniqueEmail('admin'),
    role: 'Admin',
  });
  const admin = await acceptInFreshBrowser(browser, inviteUrl);

  await admin.page.goto('/admin/users');
  const roleOptions = await admin.page
    .getByLabel('Role', { exact: true })
    .locator('option')
    .allTextContents();
  expect(roleOptions).toEqual(['Admin', 'Manager', 'Employee']);
  await admin.context.close();
});

test('departments and teams: create, add a member, and the member sees their team', async ({
  page,
  browser,
}) => {
  await registerViaUi(page, { organizationName: 'Structure Co' });
  await expect(page).toHaveURL(/\/dashboard$/);
  const email = uniqueEmail('teammate');
  const inviteUrl = await inviteViaUi(page, { name: 'Tina Teammate', email, role: 'Employee' });
  const member = await acceptInFreshBrowser(browser, inviteUrl);

  await page.goto('/admin/departments');
  await page.getByLabel('Name', { exact: true }).fill('Engineering');
  await page.getByRole('button', { name: 'Create department' }).click();
  await expect(page.getByTestId('department-Engineering')).toBeVisible();

  await page.goto('/admin/teams');
  await page.getByLabel('Name', { exact: true }).fill('Platform');
  await page.getByRole('button', { name: 'Create team' }).click();
  const team = page.getByTestId('team-Platform');
  await expect(team).toBeVisible();
  await team.getByLabel('Add member to Platform').selectOption({ label: `Tina Teammate (${email})` });
  await team.getByRole('button', { name: 'Add' }).click();
  await expect(team.getByText('Tina Teammate')).toBeVisible();

  await member.page.goto('/teams');
  await expect(member.page.getByTestId('my-team-Platform')).toBeVisible();
  await member.context.close();
});

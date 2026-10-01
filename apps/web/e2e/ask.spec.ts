import { expect, test } from '@playwright/test';

import { inviteEmployee, isolateClientIp, registerViaUi, uploadViaUi } from './helpers';

/*
 * The browser tests run the API with AI_PROVIDER=fake (see playwright.config.ts): answers are
 * canned ("According to the documents, see [1].") but retrieval, permissions, streaming,
 * citations and conversations are all real.
 */

test.beforeEach(async ({ page }) => {
  await isolateClientIp(page);
});

test('Ask AI answers from readable documents with clickable citations', async ({ page, browser }) => {
  test.setTimeout(120_000); // two documents are indexed before the journey starts
  await registerViaUi(page, { organizationName: 'Ask Co' });
  await expect(page).toHaveURL(/\/dashboard$/);
  const reader = await inviteEmployee(page, browser, 'Avery Asker');

  const handbook = await uploadViaUi(page, {
    title: 'Expense Handbook',
    content: '# Expenses\n\nSubmit expense claims within 60 days, with receipts, through the finance portal.',
    filename: 'expenses.md',
    visibility: 'Whole organization — Every member.',
  });
  await expect(page.getByTestId('document-status')).toHaveText('ready', { timeout: 60_000 });
  await uploadViaUi(page, {
    title: 'Executive Expense Exceptions',
    content: '# Exceptions\n\nExecutives may submit expense claims within 180 days.',
    filename: 'exceptions.md',
    visibility: 'Private — Only you.',
  });
  await expect(page.getByTestId('document-status')).toHaveText('ready', { timeout: 60_000 });

  // The reader asks; the answer streams in with a citation to the readable document only.
  const ask = reader.page;
  await ask.goto('/ask');
  await ask.getByLabel('Your question').fill('How long do I have to submit expense claims?');
  await ask.getByRole('button', { name: 'Ask' }).click();

  const answer = ask.getByTestId('ask-answer').last();
  await expect(answer).toHaveAttribute('data-status', 'COMPLETE', { timeout: 30_000 });
  await expect(answer).toContainText('According to the documents');
  await expect(answer.getByTestId('ask-sources')).toContainText('Expense Handbook');
  await expect(answer).not.toContainText('Executive Expense Exceptions');

  // The conversation is saved and listed; the question never appears in the URL.
  await expect(ask).toHaveURL(/\/ask\?c=[0-9a-f-]{36}$/);
  const conversationUrl = ask.url();
  await expect(ask.getByTestId('conversation-list')).toContainText(
    'How long do I have to submit expense claims?',
  );
  expect(conversationUrl).not.toContain('expense');

  // Reloading shows the stored exchange.
  await ask.reload();
  await expect(ask.getByTestId('ask-question')).toHaveText('How long do I have to submit expense claims?');
  await expect(ask.getByTestId('ask-answer')).toContainText('According to the documents');

  // Citations open the cited document.
  await ask.getByRole('link', { name: 'Source 1: Expense Handbook' }).click();
  await expect(ask).toHaveURL(handbook);

  // "Ask AI about this document" scopes questions to it.
  await ask.getByTestId('ask-about-document').click();
  await expect(ask).toHaveURL(/\/ask\?document=[0-9a-f-]{36}$/);
  await expect(ask.getByTestId('ask-scope')).toContainText('Expense Handbook');

  // Conversations are private: the owner (an admin) gets a 404 for the reader's conversation.
  await page.goto(conversationUrl);
  await expect(page.getByText(/not found|could not be found/i).first()).toBeVisible();
  await expect(page.getByTestId('ask-thread')).toHaveCount(0);

  // The reader can delete it.
  await ask.goto(conversationUrl);
  await ask.getByRole('button', { name: 'Delete conversation' }).click();
  await expect(ask).toHaveURL(/\/ask$/);
  await expect(ask.getByTestId('conversation-list')).toContainText('No conversations yet.');
  await reader.context.close();
});

test('the streaming endpoint refuses cross-site requests', async ({ page }) => {
  await registerViaUi(page);
  await expect(page).toHaveURL(/\/dashboard$/);

  const forged = await page.request.post('/ask/stream', {
    headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' },
    data: { message: 'What are our secrets?' },
  });
  expect(forged.status()).toBe(403);

  const sameOrigin = await page.request.post('/ask/stream', {
    headers: { Origin: new URL(page.url()).origin, 'Content-Type': 'application/json' },
    data: { message: '' },
  });
  expect(sameOrigin.status()).toBe(400);
});

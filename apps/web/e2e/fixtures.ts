import { expect, type Page, test as base } from '@playwright/test';

/**
 * Collects problems that would otherwise go unnoticed in a passing test: uncaught exceptions in
 * the page, and anything the Content-Security-Policy blocked (an inline script, a third-party
 * resource). Both fail the test at the end.
 */
export function watchPage(page: Page, problems: string[]): void {
  page.on('pageerror', (error) => problems.push(`Uncaught error: ${error.message}`));
  page.on('console', (message) => {
    if (
      message.type() === 'error' &&
      /Content Security Policy|Refused to (load|execute|apply|connect|frame)/i.test(message.text())
    ) {
      problems.push(`CSP violation: ${message.text()}`);
    }
  });
}

/** Use instead of `@playwright/test` in every browser test (ADR 0013). */
export const test = base.extend<{ guardedPage: void }>({
  guardedPage: [
    async ({ page, context, browser }, run) => {
      const problems: string[] = [];
      watchPage(page, problems);
      // Pages the test opens itself (new tabs, or other users in their own browser contexts)
      // are watched too.
      context.on('page', (opened) => watchPage(opened, problems));
      const newContext = browser.newContext.bind(browser);
      const newPage = browser.newPage.bind(browser);
      browser.newContext = async (...args) => {
        const created = await newContext(...args);
        created.on('page', (opened) => watchPage(opened, problems));
        return created;
      };
      browser.newPage = async (...args) => {
        const opened = await newPage(...args);
        watchPage(opened, problems);
        return opened;
      };
      try {
        await run();
      } finally {
        browser.newContext = newContext;
        browser.newPage = newPage;
      }
      expect(problems, 'the page reported errors or CSP violations').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

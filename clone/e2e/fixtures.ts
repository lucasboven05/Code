import { expect, test as base, type Page } from '@playwright/test';

export const KEY = 'alinea-style-clone.v1';
/** Every test fails on console errors, uncaught page errors and 5xx responses. */
export const test = base.extend<{ problems: string[] }>({
  problems: [async ({ page }, use) => {
    const problems: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g/.test(m.location().url)) problems.push(`console: ${m.text()} ${m.location().url}`); });
    page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
    page.on('response', (r) => { if (r.status() >= 500) problems.push(`HTTP ${r.status()} ${r.url()}`); });
    await use(problems);
    expect(problems, 'console errors / page errors / 5xx').toEqual([]);
  }, { auto: true }],
});
export { expect };

export type Opts = { goals?: string[]; horizon?: RegExp; risk?: RegExp; year?: string; name?: string; amount?: string; freq?: 'Once' | 'Weekly' | 'Every 2 wks' | 'Monthly'; start?: 'Today' | '6 months ago' | '1 year ago'; day?: string };
export async function answerQuestions(page: Page, o: Opts = {}) {
  await page.goto('/welcome'); await page.getByRole('link', { name: /Get started|Continue setup/ }).click();
  for (const g of o.goals ?? ['Just learning']) await page.getByRole('checkbox', { name: new RegExp(g) }).click(); await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('radio', { name: o.horizon ?? /10 years or more/ }).click(); await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('radio', { name: o.risk ?? /moderate dip/ }).click(); await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Birth year (optional)').fill(o.year ?? '1995'); await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Name (optional)').fill(o.name ?? 'Sam'); await page.getByRole('button', { name: 'See my sample mix' }).click();
  await page.getByRole('link', { name: 'Continue' }).click(); await expect(page).toHaveURL(/onboarding\/fund/);
}
export async function onboard(page: Page, o: Opts = {}) {
  await answerQuestions(page, o);
  await page.getByLabel('How much each time?').fill(o.amount ?? '50');
  await page.getByRole('radio', { name: o.freq ?? 'Monthly' }).click();
  if (o.day) await page.getByLabel(/Which day/).selectOption(o.day);
  await page.getByRole('radio', { name: o.start ?? '6 months ago' }).click();
  await page.getByRole('button', { name: 'Start investing' }).click(); await expect(page).toHaveURL(/\/home/); await expect(page.getByText('Holdings', { exact: true })).toBeVisible();
}
export const readState = (page: Page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), KEY);
export const overflowPx = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

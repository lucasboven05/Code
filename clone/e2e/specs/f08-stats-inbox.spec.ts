import { expect, KEY, onboard, readState, test } from '../fixtures';

test.describe('F06 stock key figures', () => {
  test('F06-E5 key figures, what drives it, and Ask Allie', async ({ page }) => {
    await onboard(page, { start: '6 months ago' }); await page.goto('/stock/S-US');
    const fig = page.getByRole('region', { name: 'Key figures' }); await expect(fig).toBeVisible();
    for (const label of ['Change over the year', 'Typical daily move', 'Worst fall from a high', 'Range']) await expect(fig.getByText(label)).toBeVisible();
    await expect(fig).not.toContainText(/NaN|Infinity|undefined/); await expect(page.getByText('What drives it')).toBeVisible();
    await page.getByRole('link', { name: 'Ask Allie about this' }).click(); await expect(page).toHaveURL(/\/allie\?ask=/);
    await expect(page.getByLabel('Ask Allie')).toHaveValue(/What drives Sample US Broad Market Fund/); expect((await readState(page)).chat, 'filled in, not sent').toHaveLength(0);
    await page.getByRole('button', { name: 'Send' }).click(); await expect(page.getByText(/swing/).first()).toBeVisible();
  });
  test('F06-E6 calm and wild investments are described differently', async ({ page }) => {
    await onboard(page, { start: 'Today', freq: 'Once' });
    await page.goto('/stock/S-STB'); await expect(page.getByText('It moves very little from day to day.')).toBeVisible();
    await page.goto('/stock/X-TOK'); await expect(page.getByText(/swing a lot in a single day/)).toBeVisible();
  });
  test('F06-E7 a question handed over in the address is capped and shown as text', async ({ page }) => {
    await onboard(page, { start: 'Today', freq: 'Once' }); const evil = '<img src=x onerror="window.__xss=1">' + 'a'.repeat(600);
    await page.goto('/allie?ask=' + encodeURIComponent(evil)); await expect(page.getByLabel('Ask Allie')).toHaveValue(/^<img src=x/); expect((await page.getByLabel('Ask Allie').inputValue()).length).toBe(500); expect(await page.evaluate(() => (window as any).__xss)).toBeUndefined();
  });
});

const WED = new Date('2026-11-04T15:00:00Z'), NEXT_WED = new Date('2026-11-11T15:00:00Z');
const bell = (page: any) => page.getByRole('link', { name: /^Inbox/ });
test.describe('F08 inbox', () => {
  test('F08-H1 a plan produces notices and the bell counts them', async ({ page }) => {
    await page.clock.setFixedTime(WED); await onboard(page, { freq: 'Weekly', start: '6 months ago' });
    await expect(bell(page)).toHaveAccessibleName(/Inbox, \d+ unread/); await bell(page).click(); await expect(page).toHaveURL(/\/inbox/);
    for (const t of ['Contribution made', 'Daily briefing', 'Weekly recap']) await expect(page.getByRole('region', { name: 'Notifications' }).getByText(t).first()).toBeVisible();
    expect(await page.locator('.sr-only', { hasText: 'Unread.' }).count()).toBeGreaterThanOrEqual(3);
    await page.getByRole('link', { name: /Daily briefing/ }).click(); await expect(page).toHaveURL(/\/briefing/);
  });
  test('F08-E1 mark all read clears the count and survives a reload', async ({ page }) => {
    await page.clock.setFixedTime(WED); await onboard(page, { freq: 'Weekly', start: '6 months ago' }); await page.goto('/inbox'); await page.getByRole('button', { name: 'Mark all read' }).click();
    await expect(page.getByRole('button', { name: 'Mark all read' })).toHaveCount(0); await expect(bell(page)).toHaveAccessibleName('Inbox'); await page.reload(); await expect(bell(page)).toHaveAccessibleName('Inbox'); await expect(page.locator('.sr-only', { hasText: 'Unread.' })).toHaveCount(0);
  });
  test('F08-E2 a week later, new notices arrive', async ({ page }) => {
    await page.clock.setFixedTime(WED); await onboard(page, { freq: 'Weekly', start: '6 months ago' }); await page.goto('/inbox'); await page.getByRole('button', { name: 'Mark all read' }).click();
    await page.clock.setFixedTime(NEXT_WED); await page.reload(); await expect(bell(page)).toHaveAccessibleName(/Inbox, [1-9]\d* unread/);
    const s = await readState(page); expect(s.inbox.filter((n: any) => n.kind === 'recap')).toHaveLength(2); expect(s.inbox.filter((n: any) => n.kind === 'contribution').map((n: any) => n.date)).toContain('2026-11-09');
  });
  test('F08-E3 switching notifications off stops them', async ({ page }) => {
    await page.clock.setFixedTime(WED); await onboard(page, { freq: 'Weekly', start: '6 months ago' }); await page.goto('/inbox'); await page.getByRole('button', { name: 'Mark all read' }).click();
    await page.goto('/settings'); for (const n of ['Daily briefing', 'Contribution made', 'Rebalance done']) await page.getByRole('switch', { name: n }).uncheck();
    await page.clock.setFixedTime(NEXT_WED); await page.reload(); const s = await readState(page); const fresh = s.inbox.filter((n: any) => !n.read);
    expect(fresh.map((n: any) => n.kind), 'only the weekly recap, which has no switch').toEqual(['recap']);
  });
  test('F08-E4 an empty inbox explains itself', async ({ page }) => {
    await page.addInitScript(([k]) => localStorage.setItem(k, JSON.stringify({ v: 1, profile: { onboardedAt: '2026-01-05', timezone: 'America/Panama', step: 5 }, account: { modelId: 'm3' } })), [KEY]);
    await page.goto('/inbox'); await expect(page.getByText('Nothing here yet')).toBeVisible(); await expect(page.getByRole('button', { name: 'Mark all read' })).toHaveCount(0); await expect(bell(page)).toHaveAccessibleName('Inbox');
  });
  test('F08-E5 loading twice never duplicates notices', async ({ page }) => {
    await page.clock.setFixedTime(WED); await onboard(page, { freq: 'Weekly', start: '1 year ago' }); const n = (await readState(page)).inbox.length;
    for (let i = 0; i < 3; i++) await page.reload(); await expect(bell(page)).toBeVisible(); expect((await readState(page)).inbox).toHaveLength(n);
    expect(n, 'a year of weekly purchases announces only the last week').toBeLessThanOrEqual(6);
  });
});

import { expect, onboard, readState, test } from '../fixtures';
const quick = (page: any) => onboard(page, { start: 'Today', freq: 'Once' });
const dialog = (page: any) => page.getByRole('dialog');

test.describe('F06 morning check', () => {
  test('F06-H1 home to briefing to a stock and back', async ({ page }) => {
    await onboard(page, { start: '6 months ago' }); await page.getByRole('link', { name: 'Daily briefing' }).click(); await expect(page.getByText('Biggest moves')).toBeVisible();
    await page.getByRole('link', { name: /rose|fell/ }).first().click(); await expect(page.getByText('About', { exact: true })).toBeVisible(); await expect(page.getByText('Your holding')).toBeVisible(); await page.getByRole('link', { name: 'Back' }).click(); await expect(page.getByText('Biggest moves')).toBeVisible();
  });
  test('F06-E1 empty states with nothing held', async ({ page }) => {
    await onboard(page, { start: 'Today', freq: 'Once', amount: '1' });
    await page.goto('/settings'); await page.getByRole('button', { name: 'Reset practice account' }).click(); await page.getByRole('button', { name: /Tap again: erase/ }).click(); await expect(page).toHaveURL(/\/onboarding/);
    await page.goto('/welcome'); await expect(page.getByRole('link', { name: /Get started|Continue setup/ })).toBeVisible();
  });
  test('F06-E2 unknown or malformed ticker', async ({ page }) => {
    await quick(page); for (const u of ['/stock/NOPE', '/stock/%3Cscript%3E']) { await page.goto(u); await expect(page.getByText('We could not find that investment'), u).toBeVisible(); }
    const r = await page.request.get('/stock/%E0%A4%A'); expect([400, 404], 'a malformed escape is refused by the server with a normal error, not a crash').toContain(r.status());
  });
  test('F06-E3 activity filters and paging', async ({ page }) => {
    await onboard(page, { freq: 'Weekly', start: '6 months ago' }); await page.goto('/activity'); await expect(page.getByRole('button', { name: 'Show more' })).toBeVisible();
    await page.getByRole('radio', { name: 'Cash' }).click(); await expect(page.getByText(/Bought /)).toHaveCount(0); await page.getByRole('radio', { name: 'Trades' }).click(); await expect(page.getByText(/Practice deposit/)).toHaveCount(0);
    await page.getByRole('radio', { name: 'All' }).click(); const before = await page.locator('.list-row').count(); await page.getByRole('button', { name: 'Show more' }).click(); expect(await page.locator('.list-row').count()).toBeGreaterThan(before);
  });
  test('F06-E4 simulated coins list', async ({ page }) => { await quick(page); await page.goto('/crypto'); await expect(page.getByText('X-COIN')).toBeVisible(); await page.getByRole('link', { name: /X-COIN/ }).click(); await expect(page.getByText('Simulated coin')).toBeVisible(); });
});

test.describe('F07 change the plan, settings', () => {
  test('F07-H1 pause, resume, change amount, add cash', async ({ page }) => {
    await onboard(page, { start: 'Today' }); await page.getByRole('button', { name: 'Pause' }).click(); await expect(page.getByText(/paused/).first()).toBeVisible(); await page.getByRole('button', { name: 'Resume' }).click(); await expect(page.getByText(/next /).first()).toBeVisible();
    await page.getByRole('button', { name: 'Change amount' }).click(); await dialog(page).getByLabel('Amount').fill('80'); await dialog(page).getByRole('button', { name: 'Save' }).click(); await expect(page.getByText(/\$80\.00 monthly/)).toBeVisible();
    const cash = (await readState(page)).account.cashCents; await page.getByRole('button', { name: 'Add practice cash' }).click(); await dialog(page).getByLabel('Amount').fill('12.34'); await dialog(page).getByRole('button', { name: 'Add cash' }).click(); await expect(page.getByText('Added practice cash.')).toBeVisible();
    expect((await readState(page)).account.cashCents).toBe(cash + 1234);
  });
  test('F07-E1 invalid amounts in the sheets', async ({ page }) => {
    await quick(page); await page.getByRole('button', { name: 'Add practice cash' }).click();
    for (const bad of ['', '0', 'abc', '1e3', '5 0', '100000.01']) { await dialog(page).getByLabel('Amount').fill(bad); await dialog(page).getByRole('button', { name: 'Add cash' }).click(); await expect(dialog(page).getByRole('alert'), `"${bad}"`).toBeVisible(); }
  });
  test('F07-E2 double-click Add cash adds once', async ({ page }) => {
    await quick(page); const cash = (await readState(page)).account.cashCents; await page.getByRole('button', { name: 'Add practice cash' }).click(); await dialog(page).getByLabel('Amount').fill('10'); await dialog(page).getByRole('button', { name: 'Add cash' }).dblclick();
    await expect(page.getByText('Added practice cash.')).toBeVisible(); expect((await readState(page)).account.cashCents).toBe(cash + 1000);
  });
  test('F07-E3 Escape closes a sheet and focus returns to the opener', async ({ page }) => {
    await quick(page); const opener = page.getByRole('button', { name: 'Add practice cash' }); await opener.click(); await expect(dialog(page)).toBeVisible(); await page.keyboard.press('Escape'); await expect(dialog(page)).toHaveCount(0); await expect(opener).toBeFocused();
  });
  test('F07-E4 settings persist after reload', async ({ page }) => {
    await quick(page); await page.goto('/settings'); await page.getByRole('switch', { name: 'Rebalance automatically' }).uncheck(); await page.getByRole('switch', { name: 'Daily briefing' }).uncheck(); await page.getByLabel('Time zone').selectOption('Europe/London');
    await page.reload(); await expect(page.getByRole('switch', { name: 'Rebalance automatically' })).not.toBeChecked(); await expect(page.getByRole('switch', { name: 'Daily briefing' })).not.toBeChecked(); await expect(page.getByLabel('Time zone')).toHaveValue('Europe/London');
  });
  test('F07-E5 reset keeps your playlists and leaves no old data', async ({ page }) => {
    await quick(page); await page.goto('/playlists/new'); await page.getByLabel('Name', { exact: true }).fill('Keep me'); await page.getByLabel('Search').first().fill('S-US'); await page.getByRole('button', { name: 'Add S-US' }).click(); await page.getByRole('button', { name: 'Spread evenly' }).click(); await page.getByRole('button', { name: 'Save playlist' }).click();
    await page.goto('/settings'); await page.getByRole('button', { name: 'Reset practice account' }).click(); await page.getByRole('button', { name: /Tap again: erase/ }).click(); await expect(page).toHaveURL(/\/onboarding/);
    const s = await readState(page); expect(s.orders).toHaveLength(0); expect(s.holdings).toHaveLength(0); expect(s.contributions).toHaveLength(0); expect(s.goals).toHaveLength(0); expect(s.chat).toHaveLength(0); expect(s.playlists.some((p: any) => p.name === 'Keep me')).toBe(true);
    await onboard(page, { start: 'Today', freq: 'Once' }); expect((await readState(page)).contributions).toHaveLength(1);
  });
  test('F07-E6 delete all data returns to welcome', async ({ page }) => {
    await quick(page); await page.goto('/settings'); await page.getByRole('button', { name: 'Delete all my data' }).click(); await page.getByRole('button', { name: /Tap again: delete everything/ }).click(); await expect(page).toHaveURL(/\/welcome/);
    expect(await readState(page)).toBeNull();
  });
});

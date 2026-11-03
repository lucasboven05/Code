import { expect, onboard, overflowPx, readState, test } from '../fixtures';
const quick = (page: any) => onboard(page, { start: 'Today', freq: 'Once' });
const amountSheet = (page: any) => page.getByRole('dialog').getByLabel('Amount');

test.describe('F02 browse and join a playlist', () => {
  test('F02-H1 search, open, invest', async ({ page }) => {
    await quick(page); await page.goto('/playlists'); await page.getByLabel('Search').fill('energy'); await page.getByText('Clean power').first().click();
    await page.getByRole('button', { name: 'Invest in this playlist' }).click(); await amountSheet(page).fill('40'); await page.getByRole('dialog').getByRole('button', { name: 'Invest' }).click(); await expect(page).toHaveURL(/\/home/);
    const s = await readState(page); expect(s.playlistInvestments).toHaveLength(1); expect(s.holdings.map((h: any) => h.ticker)).toContain('FX-SOLR');
    await page.goto('/playlists'); await expect(page.getByText('Invested', { exact: true })).toBeVisible(); await page.goto('/activity'); await expect(page.getByText(/Clean power/).first()).toBeVisible();
  });
  test('F02-E1 invalid invest amounts', async ({ page }) => {
    await quick(page); await page.goto('/playlists/p-clean'); await page.getByRole('button', { name: 'Invest in this playlist' }).click();
    for (const bad of ['', '0', '-1', 'abc', '5 0', '100000.01']) { await amountSheet(page).fill(bad); await page.getByRole('dialog').getByRole('button', { name: 'Invest' }).click(); await expect(page.getByRole('alert').first(), `"${bad}"`).toBeVisible(); await expect(page).toHaveURL(/playlists\/p-clean/); }
    expect((await readState(page)).playlistInvestments).toHaveLength(0);
  });
  test('F02-E2 double-click Invest invests once', async ({ page }) => {
    await quick(page); await page.goto('/playlists/p-clean'); await page.getByRole('button', { name: 'Invest in this playlist' }).click(); await amountSheet(page).fill('25');
    await page.getByRole('dialog').getByRole('button', { name: 'Invest' }).dblclick(); await expect(page).toHaveURL(/\/home/); const s = await readState(page);
    expect(s.playlistInvestments).toHaveLength(1); expect(s.orders.filter((o: any) => o.note === 'For Clean power')).toHaveLength(1);
  });
  test('F02-E3 playlist before setup goes to welcome', async ({ page }) => { await page.goto('/playlists/p-clean'); await expect(page).toHaveURL(/\/welcome/); });
  test('F02-E4 unknown playlist id', async ({ page }) => { await quick(page); await page.goto('/playlists/nope'); await expect(page.getByText('That playlist is gone')).toBeVisible(); });
  test.describe('F02-E5 weekend', () => {
    test('invest on a Saturday fills at Friday\'s price, dated Friday', async ({ page }) => {
      await page.clock.setFixedTime(new Date('2026-11-07T15:00:00Z'));    // Saturday
      await quick(page); await page.goto('/playlists/p-clean'); await page.getByRole('button', { name: 'Invest in this playlist' }).click(); await amountSheet(page).fill('40'); await page.getByRole('dialog').getByRole('button', { name: 'Invest' }).click(); await expect(page).toHaveURL(/\/home/);
      const s = await readState(page); const buys = s.orders.filter((o: any) => o.kind === 'buy'); expect(buys.length).toBeGreaterThan(0); for (const o of buys) expect(o.date).toBe('2026-11-06');
    });
  });
  test('F02-E6 crypto playlist works and warns', async ({ page }) => {
    await quick(page); await page.goto('/playlists/p-crypto'); await page.getByRole('button', { name: 'Invest in this playlist' }).click(); await amountSheet(page).fill('25'); await page.getByRole('dialog').getByRole('button', { name: 'Invest' }).click();
    await expect(page).toHaveURL(/\/home/); await expect(page.getByText(/You hold simulated coins/)).toBeVisible();
  });
});

async function build(page: any, name: string, tickers: string[], opts: { theme?: string; desc?: string; even?: boolean } = {}) {
  await page.goto('/playlists/new'); await page.getByLabel('Name', { exact: true }).fill(name); if (opts.theme) await page.getByLabel(/Theme/).fill(opts.theme); if (opts.desc) await page.getByLabel(/Description/).fill(opts.desc);
  for (const t of tickers) { await page.getByLabel('Search').first().fill(t); await page.getByRole('button', { name: `Add ${t}` }).click(); }
  if (opts.even !== false) await page.getByRole('button', { name: 'Spread evenly' }).click();
}
test.describe('F03 build a playlist', () => {
  test('F03-H1 create, edit, delete', async ({ page }) => {
    await quick(page); await build(page, 'Calm mix', ['S-US', 'S-BND']); await page.getByRole('button', { name: 'Save playlist' }).click(); await expect(page).toHaveURL(/\/playlists$/);
    await page.getByRole('radio', { name: 'Mine' }).click(); await page.getByText('Calm mix').click(); await page.getByRole('link', { name: 'Edit' }).click(); await page.getByLabel('Name', { exact: true }).fill('Calmer mix'); await page.getByRole('button', { name: 'Save changes' }).click();
    await page.getByRole('radio', { name: 'Mine' }).click(); await expect(page.getByText('Calmer mix')).toBeVisible(); await page.getByText('Calmer mix').click();
    await page.getByRole('button', { name: 'Delete' }).click(); await page.getByRole('button', { name: 'Tap again to delete' }).click(); await expect(page).toHaveURL(/\/playlists$/); await page.getByRole('radio', { name: 'Mine' }).click(); await expect(page.getByText('You have not made a playlist')).toBeVisible();
  });
  test('F03-E1 empty name is refused', async ({ page }) => { await quick(page); await build(page, '', ['S-US']); await page.getByRole('button', { name: 'Save playlist' }).click(); await expect(page.getByText('Give your playlist a name.')).toBeVisible(); expect((await readState(page)).playlists.filter((p: any) => p.owner === 'me')).toHaveLength(0); });
  test('F03-E2 weights not 100% disable Save', async ({ page }) => {
    await quick(page); await build(page, 'x', ['S-US', 'S-BND'], { even: false }); await page.getByLabel('S-US weight percent').fill('60'); await page.getByLabel('S-BND weight percent').fill('30');
    await expect(page.getByText(/Weights add up to 90%/)).toBeVisible(); await expect(page.getByRole('button', { name: 'Save playlist' })).toBeDisabled();
  });
  test('F03-E3 negative or oversized weights cannot be saved', async ({ page }) => {
    await quick(page); await build(page, 'x', ['S-US', 'S-BND'], { even: false });
    await page.getByLabel('S-US weight percent').fill('-50'); await page.getByLabel('S-BND weight percent').fill('150'); await expect(page.getByRole('button', { name: 'Save playlist' }), 'sums to 100 but one weight is negative').toBeDisabled();
    await page.getByLabel('S-US weight percent').fill('abc'); await page.getByLabel('S-BND weight percent').fill('100'); await expect(page.getByRole('button', { name: 'Save playlist' }), 'a row without a number blocks saving').toBeDisabled(); await expect(page.getByText(/Give every investment a weight/)).toBeVisible();
    await page.getByLabel('S-BND weight percent').fill('1000'); await expect(page.getByRole('button', { name: 'Save playlist' })).toBeDisabled();
  });
  test('F03-E4 an investment cannot be added twice', async ({ page }) => { await quick(page); await build(page, 'x', ['S-US']); await page.getByLabel('Search').first().fill('S-US'); await expect(page.getByRole('button', { name: 'Add S-US' })).toHaveCount(0); });
  test('F03-E5 60 characters with no spaces do not break the layout', async ({ page }) => {
    await quick(page); const long = 'W'.repeat(60); await build(page, long, ['S-US'], { theme: 'T'.repeat(30), desc: 'D'.repeat(140) }); await page.getByRole('button', { name: 'Save playlist' }).click();
    for (const u of ['/playlists']) { await page.goto(u); await page.getByRole('radio', { name: 'Mine' }).click(); await expect(page.getByText(long).first()).toBeVisible(); expect(await overflowPx(page), u).toBe(0); }
    await page.getByText(long).first().click(); await expect(page.getByRole('button', { name: 'Edit' }).or(page.getByRole('link', { name: 'Edit' })).first()).toBeVisible(); expect(await overflowPx(page), 'detail').toBe(0);
    await page.getByRole('link', { name: 'Edit' }).click(); await expect(page.getByLabel('Name', { exact: true })).toHaveValue(long); expect(await overflowPx(page), 'builder').toBe(0);
  });
  test('F03-E6 markup is shown as text and never runs', async ({ page }) => {
    await quick(page); const evil = '<img src=x onerror="window.__xss=1">'; await build(page, evil, ['S-US'], { theme: '<script>window.__xss=1</script>', desc: '<svg onload="window.__xss=1">' }); await page.getByRole('button', { name: 'Save playlist' }).click();
    await page.getByRole('radio', { name: 'Mine' }).click(); await expect(page.getByText(evil)).toBeVisible(); await page.getByText(evil).click(); await expect(page.getByText(evil).first()).toBeVisible();
    expect(await page.evaluate(() => (window as any).__xss)).toBeUndefined(); expect(await page.locator('main img[src="x"]').count()).toBe(0);
  });
  test('F03-E7 three equal weights total exactly 100%', async ({ page }) => {
    await quick(page); await build(page, 'Thirds', ['S-US', 'S-BND', 'S-INT']); await page.getByRole('button', { name: 'Save playlist' }).click(); await expect(page).toHaveURL(/\/playlists$/);
    const p = (await readState(page)).playlists.find((x: any) => x.name === 'Thirds'); expect(p.items.reduce((t: number, i: any) => t + i.weightBps, 0)).toBe(10000);
  });
  test('F03-E8 deleting an invested playlist leaves holdings and history', async ({ page }) => {
    await quick(page); await build(page, 'Invested mix', ['S-US', 'S-BND']); await page.getByRole('button', { name: 'Save playlist' }).click(); await page.getByRole('radio', { name: 'Mine' }).click(); await page.getByText('Invested mix').first().click();
    await page.getByRole('button', { name: 'Invest in this playlist' }).click(); await amountSheet(page).fill('30'); await page.getByRole('dialog').getByRole('button', { name: 'Invest' }).click(); await expect(page).toHaveURL(/\/home/);
    const before = (await readState(page)).orders.length; await page.goto('/playlists'); await page.getByRole('radio', { name: 'Mine' }).click(); await page.getByText('Invested mix').first().click(); await page.getByRole('button', { name: 'Delete' }).click(); await page.getByRole('button', { name: 'Tap again to delete' }).click();
    await page.goto('/home'); await expect(page.getByText('Holdings', { exact: true })).toBeVisible(); expect((await readState(page)).orders.length).toBe(before); await page.goto('/activity'); await expect(page.getByText(/Invested mix/).first()).toBeVisible();
  });
});

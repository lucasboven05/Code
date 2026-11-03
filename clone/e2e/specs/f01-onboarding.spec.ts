import { answerQuestions, expect, KEY, onboard, readState, test } from '../fixtures';

test.describe('F01 onboard and invest', () => {
  test('F01-H1 full happy path', async ({ page }) => {
    await onboard(page, { amount: '75' }); const s = await readState(page);
    expect(s.contributions).toHaveLength(1); expect(s.holdings.length).toBe(5); expect(s.orders.filter((o: any) => o.kind === 'deposit').length).toBeGreaterThanOrEqual(6);
    await expect(page.locator('.big').first()).toContainText('$');
  });
  test('F01-H2 reload mid-questionnaire resumes', async ({ page }) => {
    await page.goto('/onboarding'); await page.getByRole('checkbox', { name: /Retirement/ }).click(); await page.getByRole('button', { name: 'Continue' }).click(); await page.getByRole('radio', { name: /5 to 10 years/ }).click(); await page.getByRole('button', { name: 'Continue' }).click();
    await page.reload(); await expect(page.getByText('Step 3 of 5')).toBeVisible();
    await page.getByRole('button', { name: 'Back' }).click(); await expect(page.getByRole('radio', { name: /5 to 10 years/ })).toHaveAttribute('aria-checked', 'true');
  });
  test('F01-H3 Back keeps earlier answers', async ({ page }) => {
    await page.goto('/onboarding'); await page.getByRole('checkbox', { name: /A safety cushion/ }).click(); await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Back' }).click(); await expect(page.getByRole('checkbox', { name: /A safety cushion/ })).toHaveAttribute('aria-checked', 'true');
  });
  test('F01-E1 empty answers are refused on steps 1-3', async ({ page }) => {
    await page.goto('/onboarding'); await page.getByRole('button', { name: 'Continue' }).click(); await expect(page.getByText('Pick at least one goal.')).toBeVisible(); await expect(page.getByText('Step 1 of 5')).toBeVisible();
    await page.getByRole('checkbox', { name: /Just learning/ }).click(); await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Continue' }).click(); await expect(page.getByText('Pick a time frame.')).toBeVisible();
    await page.getByRole('radio', { name: /Under 2 years/ }).click(); await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Continue' }).click(); await expect(page.getByText('Pick the answer closest to you.')).toBeVisible();
  });
  test('F01-E2 birth year boundaries', async ({ page }) => {
    await page.goto('/onboarding'); await page.getByRole('checkbox', { name: /Just/ }).click(); await page.getByRole('button', { name: 'Continue' }).click(); await page.getByRole('radio', { name: /10 years or more/ }).click(); await page.getByRole('button', { name: 'Continue' }).click(); await page.getByRole('radio', { name: /moderate/ }).click(); await page.getByRole('button', { name: 'Continue' }).click();
    const maxYear = new Date().getFullYear() - 18; const field = page.getByLabel('Birth year (optional)');
    for (const bad of ['1929', String(maxYear + 1), 'abc', '19 9', '-199', '19.9']) { await field.fill(bad); await page.getByRole('button', { name: 'Continue' }).click(); await expect(page.getByText(/Enter a four-digit year/), bad).toBeVisible(); await expect(page.getByText('Step 4 of 5')).toBeVisible(); }
    for (const good of ['1930', String(maxYear)]) { await field.fill(good); await page.getByRole('button', { name: 'Continue' }).click(); await expect(page.getByText('Step 5 of 5'), good).toBeVisible(); await page.getByRole('button', { name: 'Back' }).click(); }
  });
  test('F01-E3 names with emoji, accents, markup, 40 chars', async ({ page }) => {
    await answerQuestions(page, { name: 'Zoë 🌟 <b>Ñandú</b>' + 'x'.repeat(40) }); const s = await readState(page);
    expect(s.profile.displayName).toBe(('Zoë 🌟 <b>Ñandú</b>' + 'x'.repeat(40)).slice(0, 40));
  });
  test('F01-E4 invalid amounts are refused', async ({ page }) => {
    await answerQuestions(page);
    for (const bad of ['0', '0.99', '100000.01', '1e3', '١٠٠', '12.345', '-5', '', '   ', 'abc', '5 0']) {
      await page.getByLabel('How much each time?').fill(bad); await page.getByRole('button', { name: 'Start investing' }).click();
      await expect(page.getByRole('alert').filter({ hasText: /Enter an amount|capped/ }), `"${bad}"`).toBeVisible(); await expect(page).toHaveURL(/onboarding\/fund/);
    }
  });
  for (const good of ['1', '100000', '$1,000.50']) test(`F01-E5 amount "${good}" is accepted`, async ({ page }) => { await onboard(page, { amount: good, freq: 'Once', start: 'Today' }); });
  test('F01-E6 double-click Start investing makes one plan', async ({ page }) => {
    await answerQuestions(page); await page.getByLabel('How much each time?').fill('50'); await page.getByRole('button', { name: 'Start investing' }).dblclick(); await expect(page).toHaveURL(/\/home/);
    await expect(page.getByText('Holdings', { exact: true })).toBeVisible(); expect((await readState(page)).contributions).toHaveLength(1);
  });
  test('F01-E7 setup pages without answers go back to the questionnaire', async ({ page }) => {
    for (const u of ['/onboarding/portfolio', '/onboarding/fund']) { await page.goto(u); await expect(page).toHaveURL(/\/onboarding$/); }
  });
  test('F01-E8 a set-up user is sent Home and cannot create a second plan', async ({ page }) => {
    await onboard(page, { start: 'Today' });
    for (const u of ['/onboarding', '/onboarding/portfolio', '/onboarding/fund']) { await page.goto(u); await expect(page, u).toHaveURL(/\/home/); }
    expect((await readState(page)).contributions).toHaveLength(1);
  });
  test('F01-E9a start dates and schedules produce the expected deposits', async ({ page }) => {
    await onboard(page, { freq: 'Weekly', start: '1 year ago' }); const s = await readState(page); const deps = s.orders.filter((o: any) => o.kind === 'deposit');
    expect(deps.length).toBeGreaterThanOrEqual(50); expect(deps.length).toBeLessThanOrEqual(54); expect(new Set(deps.map((o: any) => o.date)).size).toBe(deps.length);
    for (const d of deps) { const wd = new Date(d.date + 'T00:00:00Z').getUTCDay(); expect(wd, d.date).toBeGreaterThanOrEqual(1); expect(wd, d.date).toBeLessThanOrEqual(5); }
  });
  test('F01-E9b monthly on day 28 and one-time', async ({ page }) => {
    await onboard(page, { freq: 'Monthly', day: '28', start: '1 year ago' }); const s = await readState(page); const deps = s.orders.filter((o: any) => o.kind === 'deposit');
    expect(deps.length).toBeGreaterThanOrEqual(11); expect(deps.length).toBeLessThanOrEqual(13);
  });
  test('F01-E9c one-time plan finishes after one purchase', async ({ page }) => {
    await onboard(page, { freq: 'Once', start: '6 months ago' }); const s = await readState(page);
    expect(s.orders.filter((o: any) => o.kind === 'deposit')).toHaveLength(1); expect(s.contributions[0].status).toBe('done'); await expect(page.getByText('finished')).toBeVisible();
  });
  test.describe('F01-E10 time zone', () => {
    test.use({ timezoneId: 'Asia/Tokyo' });
    test('a user ahead of New York never trades on a day that has not started there', async ({ page }) => {
      await page.clock.setFixedTime(new Date('2026-11-02T20:00:00Z'));      // Tokyo: Tue Nov 3 05:00. New York and Panama: Mon Nov 2 15:00
      await onboard(page, { start: 'Today', freq: 'Once' });
      await expect(page.getByText(/Simulated prices as of Nov 2, 2026/)).toBeVisible();
      const s = await readState(page); expect(s.orders.every((o: any) => o.date <= '2026-11-02'), 'no order dated in the future of New York').toBe(true);
    });
  });
  test.describe('F01-E10 time zone (behind New York)', () => {
    test.use({ timezoneId: 'America/Los_Angeles' });
    test('a user behind New York uses their own date', async ({ page }) => {
      await page.clock.setFixedTime(new Date('2026-11-03T06:00:00Z'));      // LA: Mon Nov 2 22:00. New York: Tue Nov 3 01:00
      await onboard(page, { start: 'Today', freq: 'Once' }); await expect(page.getByText(/Simulated prices as of Nov 2, 2026/)).toBeVisible();
    });
  });
  test('F01-N1 storage blocked: still works in memory', async ({ page }) => {
    await page.addInitScript(() => { const boom = () => { throw new DOMException('blocked', 'SecurityError'); }; Object.defineProperty(window, 'localStorage', { get: boom }); });
    await page.goto('/welcome'); await page.getByRole('link', { name: 'Get started' }).click(); await expect(page.getByText('Step 1 of 5')).toBeVisible();
  });
  test('F01-N2 corrupt stored data starts fresh', async ({ page }) => {
    await page.addInitScript(([k]) => localStorage.setItem(k, '{not json'), [KEY]); await page.goto('/'); await expect(page).toHaveURL(/\/welcome/); await expect(page.getByRole('heading', { name: /Learn to invest/ })).toBeVisible();
  });
  for (const [name, raw, expectation] of [['empty object', '{"v":1}', 'welcome'], ['wrong types', '{"v":1,"profile":null,"account":5,"holdings":"x","orders":{}}', 'welcome'], ['missing arrays', '{"v":1,"profile":{"onboardedAt":"2026-01-05","timezone":"America/Panama"},"account":{"cashCents":0}}', 'usable']] as const)
    test(`F01-N3 partial stored data (${name}) recovers`, async ({ page }) => {
      await page.addInitScript(([k, v]) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem(k, v); sessionStorage.setItem('seeded', '1'); } }, [KEY, raw]); await page.goto('/home');
      if (expectation === 'welcome') await expect(page.getByRole('heading', { name: /Learn to invest/ })).toBeVisible();
      else await expect(page.getByText('Holdings', { exact: true })).toBeVisible();
      await expect(page.locator('body')).not.toContainText(/Application error|Unhandled Runtime Error/);
    });
});

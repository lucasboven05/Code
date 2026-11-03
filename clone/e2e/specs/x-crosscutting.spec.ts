import AxeBuilder from '@axe-core/playwright';
import { answerQuestions, expect, onboard, overflowPx, readState, test } from '../fixtures';
const quick = (page: any) => onboard(page, { start: '6 months ago' });
const PAGES = ['/welcome', '/onboarding', '/onboarding/portfolio', '/onboarding/fund', '/home', '/stock/S-US', '/playlists', '/playlists/p-clean', '/playlists/new', '/goals', '/allie', '/briefing', '/activity', '/crypto', '/settings', '/legal'];

for (const scheme of ['light', 'dark'] as const) test.describe(`X-A1 accessibility (${scheme})`, () => {
  test.use({ colorScheme: scheme });
  test(`axe finds no WCAG A/AA violations on all screens`, async ({ page }) => {
    test.setTimeout(150_000); const found: string[] = [];
    const scan = async (u: string) => { await page.waitForTimeout(300); for (const v of (await new AxeBuilder({ page: page as any }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations) found.push(`${u}: ${v.id} (${v.impact}) x${v.nodes.length} e.g. ${v.nodes[0].target.join(' ')}`); };
    for (const u of ['/welcome', '/onboarding']) { await page.goto(u); await scan(u); }
    await answerQuestions(page); await scan('/onboarding/fund'); await page.goto('/onboarding/portfolio'); await scan('/onboarding/portfolio');
    await page.goto('/onboarding/fund'); await page.getByLabel('How much each time?').fill('50'); await page.getByRole('button', { name: 'Start investing' }).click(); await expect(page).toHaveURL(/\/home/);
    for (const u of PAGES.filter((x) => !x.startsWith('/onboarding') && x !== '/welcome')) { await page.goto(u); await scan(u); }
    expect(found).toEqual([]);
  });
});

const focusedLabel = (page: any) => page.evaluate(() => { const e = document.activeElement as HTMLElement | null; return e ? (e.getAttribute('aria-label') || e.innerText || e.getAttribute('placeholder') || '').trim() : ''; });
async function tabTo(page: any, name: RegExp | string, max = 40) {
  for (let i = 0; i < max; i++) { await page.keyboard.press('Tab'); const l = await focusedLabel(page); if (typeof name === 'string' ? l === name : name.test(l)) return; }
  throw new Error('could not reach ' + name + ' by keyboard');
}
/** In a single-choice group the options are one Tab stop; arrow keys move between (and select) them, like native radio buttons. */
async function arrowTo(page: any, name: RegExp, max = 8) { for (let i = 0; i < max; i++) { if (name.test(await focusedLabel(page))) return; await page.keyboard.press('ArrowDown'); } throw new Error('arrow keys never reached ' + name); }
/** Put the keyboard starting point at the top of the page (blur() alone leaves it at the last focused button). */
const fromTop = (page: any) => page.evaluate(() => { (document.activeElement as HTMLElement | null)?.blur(); const h = document.querySelector('h1') as HTMLElement; h.tabIndex = -1; h.focus(); });
test.describe('X-K1 keyboard only', () => {
  test('the whole questionnaire can be completed without a mouse', async ({ page }) => {
    await page.goto('/onboarding'); await fromTop(page); await tabTo(page, /Retirement/); await page.keyboard.press('Space'); await tabTo(page, 'Continue'); await page.keyboard.press('Enter');
    await expect(page.getByText('Step 2 of 5')).toBeVisible(); await fromTop(page); await tabTo(page, /Under 2 years/); await arrowTo(page, /10 years or more/); await expect(page.getByRole('radio', { name: /10 years or more/ })).toHaveAttribute('aria-checked', 'true'); await tabTo(page, 'Continue'); await page.keyboard.press('Enter');
    await expect(page.getByText('Step 3 of 5')).toBeVisible(); await fromTop(page); await tabTo(page, /any drop/); await arrowTo(page, /big swings/i); await tabTo(page, 'Continue'); await page.keyboard.press('Enter'); await expect(page.getByText('Step 4 of 5')).toBeVisible();
    await fromTop(page); await tabTo(page, 'Continue'); await page.keyboard.press('Enter'); await expect(page.getByText('Step 5 of 5')).toBeVisible(); await expect(page.getByRole('button', { name: 'See my sample mix' }), 'focus stays on the primary button, now relabelled').toBeFocused(); await page.keyboard.press('Enter'); await expect(page).toHaveURL(/onboarding\/portfolio/);
  });
  test('focus stays inside an open sheet', async ({ page }) => {
    await quick(page); await page.getByRole('button', { name: 'Add practice cash' }).click(); for (let i = 0; i < 8; i++) { await page.keyboard.press('Tab'); expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')), `tab #${i + 1}`).toBe(true); }
    for (let i = 0; i < 8; i++) { await page.keyboard.press('Shift+Tab'); expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true); }
  });
  test('arrow keys move between the options of a single-choice question', async ({ page }) => {
    await page.goto('/onboarding'); await page.getByRole('checkbox', { name: /Just/ }).click(); await page.getByRole('button', { name: 'Continue' }).click(); await fromTop(page);
    await tabTo(page, /Under 2 years/); await page.keyboard.press('ArrowDown'); await expect(page.getByRole('radio', { name: /2 to 5 years/ })).toBeFocused(); await expect(page.getByRole('radio', { name: /2 to 5 years/ })).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('ArrowUp'); await expect(page.getByRole('radio', { name: /Under 2 years/ })).toBeFocused();
  });
});

test.describe('X-R1 narrow screens', () => {
  for (const width of [320, 390]) test(`no horizontal scroll at ${width}px on every page`, async ({ page }) => {
    test.setTimeout(120_000); await page.setViewportSize({ width, height: 700 }); await quick(page); const bad: string[] = [];
    for (const u of PAGES.filter((x) => x !== '/welcome')) { await page.goto(u); await page.waitForTimeout(250); const o = await overflowPx(page); if (o) bad.push(`${u} (+${o}px)`); }
    expect(bad).toEqual([]);
  });
});

test.describe('X-T two tabs', () => {
  test('X-T1 changes made in two tabs are both kept', async ({ context }) => {
    const a = await context.newPage(); await onboard(a, { start: 'Today', freq: 'Once' }); const b = await context.newPage(); await b.goto('/home'); await b.getByText('Holdings', { exact: true }).waitFor();
    const base = (await readState(a)).account.cashCents;
    await a.getByRole('button', { name: 'Add practice cash' }).click(); await a.getByRole('dialog').getByLabel('Amount').fill('10'); await a.getByRole('dialog').getByRole('button', { name: 'Add cash' }).click(); await expect(a.getByText('Added practice cash.')).toBeVisible();
    await b.getByRole('button', { name: 'Add practice cash' }).click(); await b.getByRole('dialog').getByLabel('Amount').fill('20'); await b.getByRole('dialog').getByRole('button', { name: 'Add cash' }).click(); await expect(b.getByText('Added practice cash.')).toBeVisible();
    expect((await readState(b)).account.cashCents).toBe(base + 3000);
  });
  test('X-T2 a change in one tab shows up in the other', async ({ context }) => {
    const a = await context.newPage(); await onboard(a, { start: 'Today', freq: 'Once' }); const b = await context.newPage(); await b.goto('/home'); await b.getByText('Holdings', { exact: true }).waitFor();
    await a.getByRole('button', { name: 'Add practice cash' }).click(); await a.getByRole('dialog').getByLabel('Amount').fill('77'); await a.getByRole('dialog').getByRole('button', { name: 'Add cash' }).click(); await expect(a.getByText('Added practice cash.')).toBeVisible();
    await expect(b.getByText(/Cash: \$77\./)).toBeVisible();
  });
});

test('X-N1 blocked web fonts: layout still fits and nothing breaks', async ({ page }) => {
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort()); await quick(page); for (const u of ['/home', '/playlists', '/goals', '/allie']) { await page.goto(u); await page.waitForTimeout(200); expect(await overflowPx(page), u).toBe(0); }
});
test('X-S1 a markup name never runs as script anywhere it is shown', async ({ page }) => {
  await onboard(page, { name: '<img src=x onerror="window.__xss=1">', start: 'Today', freq: 'Once' }); for (const u of ['/home', '/settings', '/allie']) { await page.goto(u); await page.waitForTimeout(200); expect(await page.evaluate(() => (window as any).__xss), u).toBeUndefined(); }
});

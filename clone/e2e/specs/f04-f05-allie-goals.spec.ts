import { expect, onboard, overflowPx, readState, test } from '../fixtures';
const quick = (page: any) => onboard(page, { start: 'Today', freq: 'Once' });

test.describe('F04 Allie', () => {
  test('F04-H1 ask and get an answer with the disclaimer', async ({ page }) => {
    await quick(page); await page.goto('/allie'); await page.getByRole('button', { name: 'What is an ETF?' }).click(); await expect(page.getByText(/bundles many investments/)).toBeVisible(); await expect(page.getByText(/not investment advice/).last()).toBeVisible();
    await page.getByRole('button', { name: 'My recap' }).click(); await expect(page.getByText(/Recap: your practice account is worth/)).toBeVisible();
  });
  test('F04-E1 empty or blank question sends nothing', async ({ page }) => {
    await quick(page); await page.goto('/allie'); const send = page.getByRole('button', { name: 'Send' }); await expect(send).toBeDisabled(); await page.getByLabel('Ask Allie').fill('    '); await expect(send).toBeDisabled(); expect((await readState(page)).chat).toHaveLength(0);
  });
  test('F04-E2 double-click Send asks once', async ({ page }) => {
    await quick(page); await page.goto('/allie'); await page.getByLabel('Ask Allie').fill('what is diversification'); await page.getByRole('button', { name: 'Send' }).dblclick(); await expect(page.getByText(/Diversifying means/)).toBeVisible();
    const chat = (await readState(page)).chat; expect(chat.filter((m: any) => m.role === 'user')).toHaveLength(1); expect(chat.filter((m: any) => m.role === 'assistant')).toHaveLength(1);
  });
  test('F04-E3 markup in a question is shown as text', async ({ page }) => {
    await quick(page); await page.goto('/allie'); const evil = '<img src=x onerror="window.__xss=1"> risk?'; await page.getByLabel('Ask Allie').fill(evil); await page.getByRole('button', { name: 'Send' }).click();
    await expect(page.getByText(evil, { exact: false }).first()).toBeVisible(); expect(await page.evaluate(() => (window as any).__xss)).toBeUndefined();
  });
  test('F04-E4 buy/sell advice is refused', async ({ page }) => {
    await quick(page); await page.goto('/allie'); await page.getByLabel('Ask Allie').fill('What should I buy right now?'); await page.getByRole('button', { name: 'Send' }).click(); await expect(page.getByText(/I cannot say what you should buy or sell/)).toBeVisible();
  });
  test('F04-E5 emoji and accents', async ({ page }) => {
    await quick(page); await page.goto('/allie'); await page.getByLabel('Ask Allie').fill('¿Qué es un fondo? 📈'); await page.getByRole('button', { name: 'Send' }).click(); await expect(page.getByText('¿Qué es un fondo? 📈')).toBeVisible();
  });
  test('F04-E6 conversation survives a reload', async ({ page }) => {
    await quick(page); await page.goto('/allie'); await page.getByRole('button', { name: 'What is an ETF?' }).click(); await expect(page.getByText(/bundles many/)).toBeVisible(); await page.reload(); await expect(page.getByText(/bundles many/)).toBeVisible();
  });
  test('F04-E7 recap with nothing to recap is friendly', async ({ page }) => {
    await quick(page); await page.goto('/settings'); await page.getByRole('button', { name: 'Reset practice account' }).click(); await page.getByRole('button', { name: /Tap again: erase/ }).click(); await expect(page).toHaveURL(/\/onboarding/);
    await onboard(page, { start: 'Today', freq: 'Once', amount: '1' }); await page.goto('/allie'); await page.getByRole('button', { name: 'My recap' }).click(); await expect(page.getByText(/Recap:/)).toBeVisible();
  });
  test('F04-E8 the conversation is a labelled live region', async ({ page }) => { await quick(page); await page.goto('/allie'); await expect(page.getByRole('log', { name: 'Conversation with Allie' })).toBeVisible(); });
});

const sheet = (page: any) => page.getByRole('dialog');
async function addGoal(page: any, name: string, amount: string, year: string) {
  await page.goto('/goals'); await page.getByRole('button', { name: /Add a? ?goal/ }).first().click(); await sheet(page).getByLabel('Name').fill(name); await sheet(page).getByLabel('Target amount').fill(amount); await sheet(page).getByLabel('Target year').fill(year); await sheet(page).getByRole('button', { name: 'Save goal' }).click();
}
test.describe('F05 goals', () => {
  test('F05-H1 add a goal, see a projection, move the slider', async ({ page }) => {
    await onboard(page, { amount: '100', start: '6 months ago' }); const y = new Date().getFullYear() + 8; await addGoal(page, 'A deposit', '25000', String(y));
    await expect(page.getByText(/At 5% a year you would have about/)).toBeVisible(); await page.getByLabel('Assumed yearly growth').focus(); await page.keyboard.press('ArrowRight'); await expect(page.getByText(/At 5.5% a year/)).toBeVisible();
  });
  test('F05-E1 invalid goals are refused', async ({ page }) => {
    await quick(page); await page.goto('/goals'); await page.getByRole('button', { name: 'Add a goal' }).click(); const save = sheet(page).getByRole('button', { name: 'Save goal' });
    await save.click(); await expect(page.getByText('Give your goal a name.')).toBeVisible(); await expect(page.getByText('Enter an amount above zero.')).toBeVisible();
    await sheet(page).getByLabel('Name').fill('x'); await sheet(page).getByLabel('Target amount').fill('0'); await sheet(page).getByLabel('Target year').fill('2001'); await save.click(); await expect(page.getByText(/Pick a year between/)).toBeVisible();
    await sheet(page).getByLabel('Target year').fill(String(new Date().getFullYear() + 61)); await save.click(); await expect(page.getByText(/Pick a year between/)).toBeVisible(); expect((await readState(page)).goals).toHaveLength(0);
  });
  test('F05-E2 edit and delete', async ({ page }) => {
    await quick(page); const y = String(new Date().getFullYear() + 5); await addGoal(page, 'Trip', '3000', y); await page.getByRole('button', { name: 'Edit' }).click(); await sheet(page).getByLabel('Name').fill('Big trip'); await sheet(page).getByRole('button', { name: 'Save goal' }).click(); await expect(page.getByText('Big trip')).toBeVisible();
    await page.reload(); await expect(page.getByText('Big trip')).toBeVisible(); await page.getByRole('button', { name: 'Delete' }).click(); await expect(page.getByText('No goals yet')).toBeVisible();
  });
  test('F05-E3 a target below $1 is refused', async ({ page }) => {
    await quick(page); await addGoal(page, 'Tiny', '0.50', String(new Date().getFullYear() + 3)); await expect(page.getByRole('dialog').getByText('Enter a target of at least $1.00.')).toBeVisible(); expect((await readState(page)).goals).toHaveLength(0);
  });
  test('F05-E4 60 characters with no spaces do not break the layout', async ({ page }) => {
    await quick(page); const long = 'G'.repeat(60); await addGoal(page, long.slice(0, 40), '5000', String(new Date().getFullYear() + 4)); await expect(page.getByText(long.slice(0, 40))).toBeVisible(); expect(await overflowPx(page)).toBe(0);
  });
  test('F05-E5 a very large target stays readable', async ({ page }) => {
    await quick(page); await addGoal(page, 'Huge', '99999999', String(new Date().getFullYear() + 40)); await expect(page.getByText(/At 5% a year/)).toBeVisible(); await expect(page.locator('main')).not.toContainText(/NaN|Infinity|undefined/); expect(await overflowPx(page)).toBe(0);
  });
  test('F05-E6 a one-year goal with no recurring plan has sensible text', async ({ page }) => {
    await quick(page); await addGoal(page, 'Soon', '1000', String(new Date().getFullYear() + 1)); await expect(page.getByText(/At 5% a year/)).toBeVisible(); await expect(page.locator('main')).not.toContainText(/NaN|Infinity|undefined/);
  });
  test('F05-E7 goals before setup go to welcome', async ({ page }) => { await page.goto('/goals'); await expect(page).toHaveURL(/\/welcome/); });
});

// End-to-end check of the core loop (F01) plus screenshots for replica-diff. Run with the dev server up on :3100.
const { chromium } = require('playwright');
const OUT = require('path').resolve(__dirname, '../../replica/clone-screens');
(async () => {
  const b = await chromium.launch(); const errors = [];
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'America/Panama' });
  const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); }); p.on('pageerror', (e) => errors.push('pageerror: ' + e));
  const shot = (n, full = true) => p.screenshot({ path: `${OUT}/${n}.png`, fullPage: full });
  await p.goto('http://localhost:3100/'); await p.waitForURL('**/welcome'); await shot('S01');
  await p.getByRole('link', { name: 'Get started' }).click(); await p.waitForURL('**/onboarding');
  // validation: continue with nothing selected
  await p.getByRole('button', { name: 'Continue' }).click(); await p.getByText('Pick at least one goal.').waitFor();
  await p.getByRole('checkbox', { name: /Retirement/ }).click(); await p.getByRole('checkbox', { name: /Just learning/ }).click(); await shot('S02');
  await p.getByRole('button', { name: 'Continue' }).click();
  await p.getByRole('radio', { name: /10 years or more/ }).click(); await p.getByRole('button', { name: 'Continue' }).click();
  await p.getByRole('radio', { name: /big drops for more growth/ }).click(); await p.getByRole('button', { name: 'Continue' }).click();
  await p.getByLabel('Birth year (optional)').fill('1995'); await p.getByRole('button', { name: 'Continue' }).click();
  await p.getByLabel('Name (optional)').fill('Sam'); await p.getByRole('button', { name: 'See my sample mix' }).click();
  await p.waitForURL('**/onboarding/portfolio'); await p.getByText('Growth mix').waitFor(); await shot('S03');
  await p.getByRole('link', { name: 'Continue' }).click(); await p.waitForURL('**/onboarding/fund');
  await p.getByLabel('How much each time?').fill('0'); await p.getByRole('button', { name: 'Start investing' }).click(); await p.getByText('Enter an amount of at least $1.00.').waitFor();
  await p.getByLabel('How much each time?').fill('75'); await shot('S04');
  await p.getByRole('button', { name: 'Start investing' }).click(); await p.waitForURL('**/home'); await p.getByText('Holdings').waitFor(); await p.waitForTimeout(500);
  await shot('S05');
  const total = await p.locator('.big').first().innerText(); console.log('home total:', total);
  const rows = await p.locator('a.list-row').count(); console.log('holding rows:', rows);
  const st = await p.evaluate(() => JSON.parse(localStorage.getItem('alinea-style-clone.v1')));
  console.log('orders:', st.orders.length, 'deposits:', st.orders.filter((o) => o.kind === 'deposit').length, 'cash cents:', st.account.cashCents, 'net deposits:', st.account.netDepositsCents);
  // reload: state persists and jobs do not double-run
  await p.reload(); await p.getByText('Holdings').waitFor(); await p.waitForTimeout(400);
  const st2 = await p.evaluate(() => JSON.parse(localStorage.getItem('alinea-style-clone.v1'))); console.log('orders after reload:', st2.orders.length);
  const desk = await ctx.newPage(); await desk.setViewportSize({ width: 1440, height: 900 }); await desk.goto('http://localhost:3100/home'); await desk.getByText('Holdings').waitFor(); await desk.waitForTimeout(400);
  await desk.screenshot({ path: `${OUT}/S05-1440.png`, fullPage: true });
  const ov = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); console.log('horizontal overflow @390:', ov);
  console.log('errors:', errors.length ? errors : 'none'); await b.close();
})().catch((e) => { console.error('E2E FAILED:', e.message); process.exit(1); });

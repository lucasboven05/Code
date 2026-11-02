// Drives every built screen: interactions, validation, empty states, keyboard, overflow, console errors.
const { chromium } = require('playwright'); const assert = require('node:assert/strict');
const OUT = require('path').resolve(__dirname, '../../replica/clone-screens'); const BASE = 'http://localhost:3100';
(async () => {
  const b = await chromium.launch(); const errors = []; const log = (...a) => console.log('✓', ...a);
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'America/Panama' }); const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error') errors.push(`console@${p.url()}: ${m.text()}`); }); p.on('pageerror', (e) => errors.push(`pageerror@${p.url()}: ${e}`));
  const shot = (n) => p.screenshot({ path: `${OUT}/${n}.png`, fullPage: true });
  const overflow = () => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const go = async (path, ready) => { await p.goto(BASE + path); await p.getByText(ready).first().waitFor(); await p.waitForTimeout(250); };

  // --- set up an account through the real UI, keyboard only for step 1
  await p.goto(BASE + '/onboarding'); await p.getByRole('checkbox', { name: /A first home/ }).waitFor();
  await p.keyboard.press('Tab'); await p.keyboard.press('Tab'); // skip back link, land on first choice
  const focused = await p.evaluate(() => document.activeElement?.textContent || ''); assert.match(focused, /A first home/); await p.keyboard.press('Space');
  assert.equal(await p.getByRole('checkbox', { name: /A first home/ }).getAttribute('aria-checked'), 'true'); log('questionnaire usable by keyboard');
  await p.getByRole('button', { name: 'Continue' }).click(); await p.getByRole('radio', { name: /5 to 10 years/ }).click(); await p.getByRole('button', { name: 'Continue' }).click();
  await p.getByRole('radio', { name: /moderate dip/ }).click(); await p.getByRole('button', { name: 'Continue' }).click();
  await p.getByLabel('Birth year (optional)').fill('1850'); await p.getByRole('button', { name: 'Continue' }).click(); await p.getByText(/Enter a four-digit year/).waitFor(); log('birth-year validation');
  await p.getByLabel('Birth year (optional)').fill(''); await p.getByRole('button', { name: 'Continue' }).click(); await p.getByRole('button', { name: 'See my sample mix' }).click();
  await p.waitForURL('**/onboarding/portfolio'); await p.getByText('Balanced mix').waitFor(); await p.getByRole('link', { name: 'Continue' }).click();
  await p.getByLabel('How much each time?').fill('100'); await p.getByRole('radio', { name: 'Weekly' }).click(); await p.getByRole('radio', { name: '1 year ago' }).click(); await p.getByRole('button', { name: 'Start investing' }).click(); await p.waitForURL('**/home'); await p.getByText('Holdings').waitFor();
  const st = () => p.evaluate(() => JSON.parse(localStorage.getItem('alinea-style-clone.v1')));
  let s = await st(); assert.ok(s.orders.filter((o) => o.kind === 'deposit').length >= 50, 'weekly for a year ~ 52 deposits'); assert.ok(s.account.cashCents >= 0); log('weekly plan replayed over a year:', s.orders.filter((o) => o.kind === 'deposit').length, 'deposits');
  const days = new Set(s.orders.filter((o) => o.kind === 'deposit').map((o) => o.date)); assert.equal(days.size, s.orders.filter((o) => o.kind === 'deposit').length, 'no duplicate deposit dates');
  assert.ok(s.orders.some((o) => o.kind.startsWith('rebalance')), 'rebalance happened over a year'); log('rebalancing fired during replay:', s.orders.filter((o) => o.kind.startsWith('rebalance')).length, 'orders');

  // --- Home actions
  await p.getByRole('button', { name: 'Pause' }).click(); await p.getByText('paused').first().waitFor(); await p.getByRole('button', { name: 'Resume' }).click(); log('pause / resume plan');
  await p.getByRole('button', { name: 'Add practice cash' }).click(); await p.getByRole('dialog').getByRole('button', { name: 'Add cash' }).click(); await p.getByText('Enter an amount above zero.').waitFor();
  await p.getByRole('dialog').getByLabel('Amount').fill('20'); await p.getByRole('dialog').getByRole('button', { name: 'Add cash' }).click(); await p.getByText('Added practice cash.').waitFor(); log('add cash with validation');
  await p.getByRole('button', { name: 'Change amount' }).click(); await p.keyboard.press('Escape'); assert.equal(await p.getByRole('dialog').count(), 0); log('sheet closes with Escape');
  assert.equal(await overflow(), 0);

  // --- Stock profile
  await go('/stock/S-US', 'About'); await shot('S06'); await p.getByText('Your holding').waitFor(); assert.equal(await overflow(), 0);
  await go('/stock/NOPE', 'We could not find that investment'); log('S06 profile + not-found state');

  // --- Playlists
  await go('/playlists', 'Clean power'); await p.getByLabel('Search').fill('zzz'); await p.getByText('No playlists match').waitFor(); await p.getByLabel('Search').fill('energy'); await p.getByText('Clean power').first().waitFor();
  await p.getByLabel('Search').fill(''); await p.getByRole('radio', { name: 'Mine' }).click(); await p.getByText('You have not made a playlist').waitFor(); await p.getByRole('radio', { name: 'All playlists' }).click(); await shot('S07'); log('S07 search + empty states');
  await go('/playlists/p-clean', 'Invest in this playlist'); await shot('S08');
  const before = (await st()).holdings.length; await p.getByRole('button', { name: 'Invest in this playlist' }).click(); await p.getByRole('dialog').getByLabel('Amount').fill('40'); await p.getByRole('dialog').getByRole('button', { name: 'Invest' }).click(); await p.waitForURL('**/home');
  s = await st(); assert.ok(s.holdings.some((h) => h.ticker === 'FX-SOLR') && s.holdings.length > before); assert.equal(s.playlistInvestments.length, 1); log('invest in playlist -> holdings updated');
  // --- Builder
  await go('/playlists/new', 'Add investments'); const save = p.getByRole('button', { name: 'Save playlist' }); assert.ok(await save.isDisabled());
  await p.getByLabel('Search').first().fill('S-US'); await p.getByRole('button', { name: 'Add S-US' }).click(); await p.getByLabel('Search').first().fill('S-BND'); await p.getByRole('button', { name: 'Add S-BND' }).click();
  await p.getByLabel('S-US weight percent').fill('60'); await p.getByLabel('S-BND weight percent').fill('30'); await p.getByText(/Weights add up to 90%/).waitFor(); assert.ok(await save.isDisabled()); log('S09 weights must total 100%');
  await p.getByRole('button', { name: 'Spread evenly' }).click(); await p.getByText('Weights total 100%.').waitFor(); await shot('S09');
  await p.getByRole('button', { name: 'Save playlist' }).click(); await p.getByLabel('Name').fill('My calm mix'); await p.getByRole('button', { name: 'Save playlist' }).click(); await p.waitForURL('**/playlists'); await p.getByText('My calm mix').waitFor();
  await p.getByRole('radio', { name: 'Mine' }).click(); await p.getByText('My calm mix').waitFor(); await p.getByText('My calm mix').click(); await p.getByRole('link', { name: 'Edit' }).click(); await p.getByLabel('Name').waitFor(); assert.equal(await p.getByLabel('Name').inputValue(), 'My calm mix');
  await go('/playlists', 'My calm mix'); await p.getByText('My calm mix').click(); await p.getByRole('button', { name: 'Delete' }).click(); await p.getByRole('button', { name: 'Tap again to delete' }).click(); await p.waitForURL('**/playlists'); assert.equal(await p.getByText('My calm mix').count(), 0); log('create, edit, delete own playlist');

  // --- Goals
  await go('/goals', 'No goals yet'); await p.getByRole('button', { name: 'Add a goal' }).click(); await p.getByRole('dialog').getByRole('button', { name: 'Save goal' }).click(); await p.getByText('Give your goal a name.').waitFor();
  await p.getByRole('dialog').getByLabel('Name').fill('A deposit for a home'); await p.getByRole('dialog').getByLabel('Target amount').fill('25000'); await p.getByRole('dialog').getByLabel('Target year').fill('2030'); await p.getByRole('dialog').getByRole('button', { name: 'Save goal' }).click(); await p.getByText('Goal saved.').waitFor();
  await p.getByText(/At 5% a year you would have about/).waitFor(); await p.getByLabel('Assumed yearly growth').focus(); await p.keyboard.press('ArrowRight'); await p.getByText(/At 5.5% a year/).waitFor(); await shot('S10'); log('S10 goal + projection moves with the rate slider');
  // --- Allie
  await go('/allie', 'Ask Allie anything about investing'); await p.getByRole('button', { name: 'What does rebalancing do?' }).click(); await p.getByText(/Rebalancing sells a little of what grew/).waitFor();
  await p.getByLabel('Ask Allie').fill('what should I buy?'); await p.getByRole('button', { name: 'Send' }).click(); await p.getByText(/I cannot say what you should buy or sell/).waitFor(); await p.getByRole('button', { name: 'My recap' }).click(); await p.getByText(/Recap: your practice account is worth/).waitFor(); await shot('S11'); log('S11 Allie explains, refuses advice, recaps');
  // --- Briefing, activity, crypto, settings, legal
  await go('/briefing', 'Biggest moves'); await shot('S12');
  await go('/activity', 'Practice deposit'); await p.getByRole('radio', { name: 'Trades' }).click(); assert.equal(await p.getByText(/Practice deposit/).count(), 0); await p.getByRole('radio', { name: 'Cash' }).click(); await p.getByText(/Practice deposit/).first().waitFor(); await p.getByRole('radio', { name: 'All' }).click(); await shot('S13'); log('S13 activity filters');
  await go('/crypto', 'Pretend coins'); await shot('S14');
  await go('/settings', 'Membership'); await p.getByRole('switch', { name: 'Rebalance automatically' }).click(); assert.equal((await st()).account.rebalanceEnabled, false); await p.getByLabel('Time zone').selectOption('America/New_York'); await shot('S16'); log('S16 settings persist');
  await go('/legal', 'What this app is'); await shot('S18');
  // --- state survives reload without double-running jobs
  await go('/home', 'Holdings'); const n1 = (await st()).orders.length; await p.reload(); await p.getByText('Holdings').waitFor(); await p.waitForTimeout(300); assert.equal((await st()).orders.length, n1); log('reload does not duplicate orders');
  // --- no horizontal overflow on every page at 390 and 1440
  const pages = ['/home', '/playlists', '/playlists/p-clean', '/playlists/new', '/goals', '/allie', '/briefing', '/activity', '/crypto', '/settings', '/legal', '/stock/FX-SOLR', '/welcome', '/onboarding'];
  const o1 = []; for (const u of pages) { await p.goto(BASE + u); await p.waitForTimeout(350); if (await overflow()) o1.push(u); } assert.deepEqual(o1, [], 'overflow at 390: ' + o1); log('no horizontal overflow at 390px on', pages.length, 'pages');
  await p.setViewportSize({ width: 1440, height: 900 }); const o2 = []; for (const u of pages) { await p.goto(BASE + u); await p.waitForTimeout(350); if (await overflow()) o2.push(u); } assert.deepEqual(o2, [], 'overflow at 1440: ' + o2); log('no horizontal overflow at 1440px');
  const ignorable = errors.filter((e) => !/Failed to load resource.*fonts/.test(e)); assert.deepEqual(ignorable, [], 'console errors:\n' + ignorable.join('\n')); log('no console errors');
  await b.close(); console.log('\nALL SCREEN CHECKS PASSED');
})().catch((e) => { console.error('\nFAILED:', e.message.split('\n').slice(0, 8).join('\n')); process.exit(1); });

// Backend-mode run against a real Postgres. Needs: DATABASE_URL, SUPABASE_JWT_SECRET, app started with NEXT_PUBLIC_BACKEND=supabase.
// The email magic-link step belongs to Supabase and cannot be run here, so the browser is given a real signed session instead.
const { chromium } = require('playwright'); const { Client } = require('pg'); const { SignJWT } = require('jose'); const assert = require('node:assert/strict');
const BASE = 'http://localhost:3100', REF = 'proj', SUPA = `https://${REF}.supabase.co`, SECRET = process.env.SUPABASE_JWT_SECRET;
const OUT = require('path').resolve(__dirname, '../../replica/clone-screens');
(async () => {
  const db = new Client({ connectionString: process.env.DATABASE_URL }); await db.connect(); const log = (...a) => console.log('✓', ...a); const errors = [];
  const uid = require('node:crypto').randomUUID(); await db.query('insert into auth.users (id, email) values ($1,$2)', [uid, 'e2e@test.invalid']);
  const jwt = await new SignJWT({ role: 'authenticated' }).setProtectedHeader({ alg: 'HS256' }).setSubject(uid).setAudience('authenticated').setIssuer(`${SUPA}/auth/v1`).setExpirationTime('2h').sign(new TextEncoder().encode(SECRET));
  const session = { access_token: jwt, refresh_token: 'unused', token_type: 'bearer', expires_in: 7200, expires_at: Math.floor(Date.now() / 1000) + 7200, user: { id: uid, aud: 'authenticated', email: 'e2e@test.invalid', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } };
  const b = await chromium.launch();
  // --- 1. signed out: sign-in screen, validation, nothing else reachable
  const c1 = await b.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'America/Panama' }); const p1 = await c1.newPage();
  await c1.route(`${SUPA}/**`, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  p1.on('pageerror', (e) => errors.push('pageerror: ' + e));
  await p1.goto(BASE + '/home'); await p1.getByRole('heading', { name: 'Sign in' }).waitFor(); await p1.screenshot({ path: `${OUT}/SIGNIN.png`, fullPage: true });
  assert.equal(await p1.getByText('Holdings').count(), 0); await p1.getByLabel('Email').fill('not-an-email'); await p1.getByRole('button', { name: 'Email me a link' }).click(); await p1.getByText('Enter a valid email address.').waitFor(); log('signed out: sign-in screen, no app content, email validation');
  const noTok = await p1.evaluate(() => fetch('/api/state').then((r) => r.status)); assert.equal(noTok, 401); log('API refuses requests with no token');
  await c1.close();
  // --- 2. signed in: whole onboarding through the server, data in Postgres not in the browser
  const c2 = await b.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'America/Panama' }); const p = await c2.newPage();
  await c2.route(`${SUPA}/**`, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await c2.addInitScript(([k, v]) => localStorage.setItem(k, v), [`sb-${REF}-auth-token`, JSON.stringify(session)]);
  p.on('console', (m) => { if (m.type() === 'error' && !/fonts|favicon/.test(m.text())) errors.push('console: ' + m.text()); }); p.on('pageerror', (e) => errors.push('pageerror: ' + e));
  await p.goto(BASE + '/'); await p.waitForURL('**/welcome'); await p.getByRole('link', { name: 'Get started' }).click();
  await p.getByRole('checkbox', { name: /Retirement/ }).click(); await p.getByRole('button', { name: 'Continue' }).click(); await p.getByRole('radio', { name: /10 years or more/ }).click(); await p.getByRole('button', { name: 'Continue' }).click();
  await p.getByRole('radio', { name: /moderate dip/ }).click(); await p.getByRole('button', { name: 'Continue' }).click(); await p.getByLabel('Birth year (optional)').fill('1990'); await p.getByRole('button', { name: 'Continue' }).click();
  await p.getByLabel('Name (optional)').fill('Sam'); await p.getByRole('button', { name: 'See my sample mix' }).click(); await p.getByText('Balanced mix').waitFor();
  const prof = (await db.query('select display_name, questionnaire_step from profiles where user_id = $1', [uid])).rows[0]; assert.deepEqual(prof, { display_name: 'Sam', questionnaire_step: 5 }); log('questionnaire answers saved to Postgres as they are given');
  await p.getByRole('link', { name: 'Continue' }).click(); await p.getByLabel('How much each time?').fill('75'); await p.getByRole('radio', { name: '1 year ago' }).click(); await p.getByRole('button', { name: 'Start investing' }).click(); await p.waitForURL('**/home'); await p.getByText('Holdings').waitFor();
  const total = await p.locator('.big').first().innerText(); const n = (await db.query(`select count(*)::int as n, count(*) filter (where kind='deposit')::int as d from orders where user_id = $1`, [uid])).rows[0];
  assert.ok(n.n > 50 && n.d >= 12, JSON.stringify(n)); log('plan replayed server-side:', n.d, 'deposits,', n.n, 'orders in Postgres; home shows', total);
  assert.equal(await p.evaluate(() => localStorage.getItem('alinea-style-clone.v1')), null); log('nothing app-related stored in the browser');
  await p.getByRole('button', { name: 'Add practice cash' }).click(); await p.getByRole('dialog').getByLabel('Amount').fill('20'); await p.getByRole('dialog').getByRole('button', { name: 'Add cash' }).click(); await p.getByText('Added practice cash.').waitFor();
  await p.goto(BASE + '/playlists/p-clean'); await p.getByRole('button', { name: 'Invest in this playlist' }).click(); await p.getByRole('dialog').getByLabel('Amount').fill('30'); await p.getByRole('dialog').getByRole('button', { name: 'Invest' }).click(); await p.waitForURL('**/home');
  await p.goto(BASE + '/allie'); await p.getByRole('button', { name: 'What does rebalancing do?' }).click(); await p.getByText(/Rebalancing sells a little of what grew/).waitFor(); log('actions work through the API (cash, playlist, Allie with no key = scripted)');
  const cash = (await db.query('select cash_cents::int as c from accounts where user_id = $1', [uid])).rows[0].c; await p.reload(); await p.goto(BASE + '/home'); await p.getByText('Holdings').waitFor(); const after = (await db.query('select count(*)::int as n from orders where user_id = $1', [uid])).rows[0].n;
  assert.ok(after >= n.n + 1); assert.equal((await db.query('select cash_cents::int as c from accounts where user_id = $1', [uid])).rows[0].c, cash); log('reload re-reads from the server; no duplicate jobs');
  await p.screenshot({ path: `${OUT}/S05-backend.png`, fullPage: true });
  // --- 3. a second signed-in user sees none of it
  const uid2 = require('node:crypto').randomUUID(); await db.query('insert into auth.users (id, email) values ($1,$2)', [uid2, 'two@test.invalid']);
  const jwt2 = await new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setSubject(uid2).setAudience('authenticated').setIssuer(`${SUPA}/auth/v1`).setExpirationTime('2h').sign(new TextEncoder().encode(SECRET));
  const st2 = await p.evaluate((t) => fetch('/api/state', { headers: { authorization: 'Bearer ' + t } }).then((r) => r.json()), jwt2); assert.equal(st2.orders.length, 0); assert.equal(st2.profile.displayName, ''); log('a second user gets an empty account, not the first user\'s data');
  // --- 4. settings: sign-in card, account deletion
  await p.goto(BASE + '/settings'); await p.getByText('Sign out on every device').waitFor(); await p.getByRole('button', { name: 'Delete my account' }).click(); await p.getByRole('button', { name: /Tap again: delete my account/ }).click();
  await p.waitForFunction(() => document.body.innerText.includes('Sign in') || document.body.innerText.includes('Practice Invest'), null, { timeout: 8000 });
  const left = (await db.query(`select (select count(*) from auth.users where id=$1)::int u, (select count(*) from orders where user_id=$1)::int o, (select count(*) from profiles where user_id=$1)::int p, (select count(*) from chat_messages where user_id=$1)::int c`, [uid])).rows[0];
  assert.deepEqual(left, { u: 0, o: 0, p: 0, c: 0 }); log('delete account removed the sign-in user and every row');
  assert.deepEqual(errors, [], errors.join('\n')); log('no console or page errors');
  await db.query('delete from auth.users where id = $1', [uid2]); await db.end(); await b.close(); console.log('\nBACKEND E2E PASSED');
})().catch((e) => { console.error('\nFAILED:', e.message.split('\n').slice(0, 10).join('\n')); process.exit(1); });

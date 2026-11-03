import { beforeAll, describe, expect, it, vi } from 'vitest';
import { SignJWT } from 'jose';
import { DISCLAIMER } from '@/lib/allie';
import { Service } from '@/lib/data';
import { authenticate, verifyToken } from '@/server/auth';
import { makeAllie, SYSTEM, type AnthropicLike } from '@/server/allie-llm';
import { runDaily } from '@/server/cron';
import type { Pool } from '@/server/db';
import { HttpError } from '@/server/http';
import { withUser } from '@/server/pgstore';
import { RateLimiter } from '@/server/ratelimit';
import { getState, handleRpc, RPC_METHODS } from '@/server/rpc';
import { addUser, makeDb, NOW } from './helpers';

let pool: Pool, A: string, B: string;
beforeAll(async () => { ({ pool } = await makeDb()); A = await addUser(pool); B = await addUser(pool); }, 60_000);
const rpc = (userId: string, method: string, ...args: unknown[]) => handleRpc({ pool, userId, method, args, now: NOW });
const code = async (p: Promise<unknown>) => { try { await p; return 0; } catch (e) { return e instanceof HttpError ? e.status : -1; } };

describe('RPC input validation', () => {
  it('exposes exactly the whitelisted actions', () => { expect(RPC_METHODS.sort()).toEqual(['addMoney', 'addRecap', 'completeOnboarding', 'createPlaylist', 'deleteEverything', 'deleteGoal', 'deletePlaylist', 'investInPlaylist', 'resetAccount', 'saveGoal', 'saveProfile', 'sendChat', 'setPrefs', 'setRebalance', 'setTimezone', 'updateContribution', 'updatePlaylist']); });
  it('rejects unknown actions, including prototype tricks', async () => {
    for (const m of ['nope', 'load', 'constructor', '__proto__', 'toString', 'save', 'state']) expect(await code(rpc(A, m)), m).toBe(400);
  });
  it('rejects malformed or out-of-range input before doing any work', async () => {
    const bad: [string, unknown[]][] = [['addMoney', [-5]], ['addMoney', [2.5]], ['addMoney', [99]], ['addMoney', [10_000_001]], ['addMoney', ['100']], ['addMoney', []],
      ['sendChat', ['x'.repeat(501)]], ['sendChat', ['   ']], ['saveProfile', [{ onboardedAt: '2020-01-01' }]], ['saveProfile', [{ riskTolerance: 9 }]], ['setTimezone', ['Mars/Olympus']],
      ['saveGoal', [{ name: 'x', targetCents: 1000, targetYear: 1999 }]], ['deleteGoal', ['not-a-uuid']],
      ['createPlaylist', [{ name: 'x', theme: '', description: '', isPublic: false, items: [{ ticker: 'AAPL', weightBps: 10000 }] }]],
      ['completeOnboarding', [{ amountCents: 5000, frequency: 'daily', dayOfWeek: null, dayOfMonth: null, start: 'today' }]]];
    for (const [m, a] of bad) expect(await code(rpc(A, m, ...a)), `${m} ${JSON.stringify(a)}`).toBe(400);
    expect((await getState({ pool, userId: A, now: NOW })).account.cashCents).toBe(0);
  });
  it('user-facing engine errors become 400s with a plain message', async () => {
    await expect(rpc(A, 'investInPlaylist', 'p-clean', 5000)).rejects.toMatchObject({ status: 400, message: 'Finish setup first' });
  });
  it('a valid flow works end to end and persists', async () => {
    await rpc(A, 'saveProfile', { riskTolerance: 3, horizonYears: 8, goals: ['Just learning'], step: 5 });
    const s = await rpc(A, 'completeOnboarding', { amountCents: 5000, frequency: 'weekly', dayOfWeek: 1, dayOfMonth: null, start: '6m' });
    expect(s.account.modelId).toBe('m3'); expect(s.orders.length).toBeGreaterThan(20);
    const s2 = await rpc(A, 'addMoney', 2500); expect(s2.account.cashCents).toBe(s.account.cashCents + 2500);
    expect((await getState({ pool, userId: A, now: NOW })).account.cashCents).toBe(s2.account.cashCents);
  });
  it('never lets one user act on another user\'s data, even with the other user\'s ids', async () => {
    const a = await getState({ pool, userId: A, now: NOW }); const c = a.contributions[0].id; const g = (await rpc(A, 'saveGoal', { name: 'Mine', targetCents: 100000, targetYear: 2030 })).goals[0].id;
    await rpc(B, 'saveProfile', { riskTolerance: 2, horizonYears: 4, step: 5 }); await rpc(B, 'completeOnboarding', { amountCents: 5000, frequency: 'monthly', dayOfWeek: null, dayOfMonth: 3, start: 'today' });
    expect(await code(rpc(B, 'updateContribution', c, { status: 'cancelled' }))).toBe(400);   // A's contribution id means nothing to B
    await rpc(B, 'deleteGoal', g);                                                              // silently a no-op for B
    const a2 = await getState({ pool, userId: A, now: NOW });
    expect(a2.contributions[0].status).toBe('active'); expect(a2.goals.map((x) => x.id)).toContain(g);
  });
});

describe('authentication', () => {
  const secret = 'test-secret-test-secret-test-secret-1234'; const env = { SUPABASE_JWT_SECRET: secret, SUPABASE_URL: 'https://proj.supabase.co' };
  const sign = (o: { sub?: string; aud?: string; iss?: string; exp?: string | number; key?: string } = {}) => new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setSubject(o.sub ?? A)
    .setAudience(o.aud ?? 'authenticated').setIssuer(o.iss ?? 'https://proj.supabase.co/auth/v1').setExpirationTime(o.exp ?? '1h').sign(new TextEncoder().encode(o.key ?? secret));
  it('accepts a valid token and returns the user id from it', async () => { expect(await verifyToken(await sign(), env)).toBe(A); });
  it('rejects expired, wrong-secret, wrong-audience, wrong-issuer, and non-uuid subjects', async () => {
    for (const t of [await sign({ exp: Math.floor(Date.now() / 1000) - 60 }), await sign({ key: 'another-secret-another-secret-another-1' }), await sign({ aud: 'anon' }), await sign({ iss: 'https://evil.example/auth/v1' }), await sign({ sub: 'admin' }), 'garbage', '']) await expect(verifyToken(t, env)).rejects.toMatchObject({ status: 401 });
  });
  it('rejects an unsigned (alg none) token', async () => {
    const b = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url'); const t = `${b({ alg: 'none', typ: 'JWT' })}.${b({ sub: A, aud: 'authenticated', iss: 'https://proj.supabase.co/auth/v1', exp: 9999999999 })}.`;
    await expect(verifyToken(t, env)).rejects.toMatchObject({ status: 401 });
  });
  it('needs a Bearer header', async () => {
    await expect(authenticate(new Request('http://x'), env)).rejects.toMatchObject({ status: 401 });
    await expect(authenticate(new Request('http://x', { headers: { authorization: 'Basic abc' } }), env)).rejects.toMatchObject({ status: 401 });
    expect(await authenticate(new Request('http://x', { headers: { authorization: 'Bearer ' + (await sign()) } }), env)).toBe(A);
  });
});

describe('rate limiting', () => {
  it('allows a burst then blocks until the window passes, per key', () => {
    const r = new RateLimiter(3, 1000); expect([1, 2, 3, 4].map(() => r.take('u', 0))).toEqual([true, true, true, false]);
    expect(r.take('other', 0)).toBe(true); expect(r.take('u', 999)).toBe(false); expect(r.take('u', 1000)).toBe(true);
  });
});

describe('Allie with the Claude API', () => {
  const state = async () => getState({ pool, userId: A, now: NOW });
  const ctx = async () => ({ state: await state(), today: '2026-06-15' });
  const client = (impl: (p: any) => any) => { const create = vi.fn(async (p: any) => impl(p)); return { create, c: { beta: { messages: { create } } } as unknown as AnthropicLike }; };
  const ok = (text: string) => ({ stop_reason: 'end_turn', content: [{ type: 'thinking' }, { type: 'text', text }] });

  it('sends a grounded, constrained request and appends the disclaimer', async () => {
    const { create, c } = client(() => ok('A fund bundles many investments.'));
    const out = await makeAllie({ client: c })('What is an ETF?', await ctx());
    expect(out).toContain('A fund bundles many investments.'); expect(out).toContain(DISCLAIMER);
    const p = create.mock.calls[0][0];
    expect(p).toMatchObject({ model: 'claude-opus-5-5', system: SYSTEM, output_config: { effort: 'low' }, fallbacks: 'default', betas: ['server-side-fallback-2026-07-01'] });
    const last = p.messages[p.messages.length - 1]; expect(last.role).toBe('user'); expect(last.content).toContain('Learner\'s question: What is an ETF?'); expect(last.content).toContain('Holdings by share');
    expect(p.messages[0].role).toBe('user'); expect(JSON.stringify(p)).not.toContain(A);          // no user id or email sent to the API
    expect(SYSTEM).toMatch(/Never tell the learner what to buy/);
  });
  it('falls back to the scripted answer on refusal, empty output, or any error', async () => {
    const cx = await ctx();
    for (const impl of [() => ({ stop_reason: 'refusal', content: [] }), () => ({ stop_reason: 'end_turn', content: [{ type: 'thinking' }] }), () => { throw new Error('boom'); }]) {
      const out = await makeAllie({ client: client(impl).c })('what does rebalancing do', cx); expect(out).toMatch(/Rebalancing sells a little of what grew/); expect(out).toContain(DISCLAIMER);
    }
  });
  it('uses the scripted answers and makes no call when no key is configured', async () => {
    const out = await makeAllie({})('what is an etf', await ctx()); expect(out).toMatch(/bundles many investments/);
  });
  it('omits server-side fallback for Haiku, which does not support it', async () => {
    const { create, c } = client(() => ok('ok')); await makeAllie({ client: c, model: 'claude-haiku-5-5' })('hi', await ctx());
    const p = create.mock.calls[0][0]; expect(p.fallbacks).toBeUndefined(); expect(p.betas).toBeUndefined(); expect(p.model).toBe('claude-haiku-5-5');
  });
  it('works through the real RPC path and stores the reply', async () => {
    const { c } = client(() => ok('Rebalancing resets your mix.'));
    const s = await handleRpc({ pool, userId: A, method: 'sendChat', args: ['explain rebalancing'], now: NOW, allie: makeAllie({ client: c }) });
    expect(s.chat.at(-1)!.content).toContain('Rebalancing resets your mix.'); expect(s.chat.at(-2)!.role).toBe('user');
  });
});

describe('daily job', () => {
  it('replays missed market days for every user, is idempotent, and isolates failures', async () => {
    const count = async (u: string) => (await getState({ pool, userId: u, now: NOW })).orders.length;
    const before = [await count(A), await count(B)]; const later = () => new Date('2026-07-20T15:00:00Z');
    const r1 = await runDaily(pool, later); expect(r1).toEqual({ users: 2, ok: 2, failed: 0 });
    const after = [await count(A), await count(B)]; expect(after[0]).toBeGreaterThan(before[0]); expect(after[1]).toBeGreaterThan(before[1]);
    await runDaily(pool, later); expect([await count(A), await count(B)]).toEqual(after);                 // second run: nothing changes
    const flaky: Pool = { ...pool, tx: (fn) => pool.tx((db) => fn({ query: (sql, p) => (sql.includes('pg_advisory_xact_lock') && p?.[0] === B ? Promise.reject(new Error('boom')) : db.query(sql, p)) })) };
    const err = vi.spyOn(console, 'error').mockImplementation(() => {}); const r2 = await runDaily(flaky, () => new Date('2026-08-20T15:00:00Z')); err.mockRestore();
    expect(r2).toEqual({ users: 2, ok: 1, failed: 1 }); expect(await count(A)).toBeGreaterThan(after[0]);  // A still processed
  });
});

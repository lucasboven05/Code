import { beforeAll, describe, expect, it, vi } from 'vitest';
import { SignJWT } from 'jose';
import { RemoteData } from '@/lib/remote';
import type { Pool } from '@/server/db';
import { handleCron, handleDeleteAccount, handleRpcRequest, handleState, type Deps } from '@/server/handlers';
import { RateLimiter } from '@/server/ratelimit';
import { addUser, makeDb, NOW } from './helpers';

const SECRET = 'test-secret-test-secret-test-secret-1234'; let pool: Pool; let A: string, B: string; let deps: Deps;
const token = (sub: string) => new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setSubject(sub).setAudience('authenticated').setIssuer('https://proj.supabase.co/auth/v1').setExpirationTime('1h').sign(new TextEncoder().encode(SECRET));
const mkDeps = (over: Partial<Deps> = {}): Deps => ({ pool: () => pool, env: () => ({ SUPABASE_URL: 'https://proj.supabase.co', SUPABASE_JWT_SECRET: SECRET, ANTHROPIC_API_KEY: undefined, ALLIE_MODEL: undefined, CRON_SECRET: 'cron-secret-value' }), now: NOW, general: new RateLimiter(1000, 60_000), chat: new RateLimiter(3, 60_000), ...over });
const req = (path: string, init: RequestInit & { tok?: string } = {}) => new Request('http://app' + path, { ...init, headers: { ...(init.tok ? { authorization: 'Bearer ' + init.tok } : {}), 'content-type': 'application/json', ...(init.headers as object) } });
beforeAll(async () => { ({ pool } = await makeDb()); A = await addUser(pool); B = await addUser(pool); deps = mkDeps(); }, 60_000);

describe('HTTP handlers', () => {
  it('require a valid bearer token', async () => {
    expect((await handleState(req('/api/state'), deps)).status).toBe(401);
    expect((await handleState(req('/api/state', { tok: 'nope' }), deps)).status).toBe(401);
    expect((await handleRpcRequest(req('/api/rpc', { method: 'POST', body: '{}' }), deps)).status).toBe(401);
    expect((await handleState(req('/api/state', { tok: await token(A) }), deps)).status).toBe(200);
  });
  it('validate the envelope: size, JSON, unknown keys, unknown methods', async () => {
    const t = await token(A); const post = (body: string) => handleRpcRequest(req('/api/rpc', { method: 'POST', body, tok: t }), deps);
    expect((await post('x'.repeat(20_001))).status).toBe(413); expect((await post('{not json')).status).toBe(400);
    expect((await post(JSON.stringify({ method: 'addMoney', args: [5000], userId: B }))).status).toBe(400);   // a client cannot name a user
    expect((await post(JSON.stringify({ method: 'drop table', args: [] }))).status).toBe(400);
    expect((await post(JSON.stringify({ method: 'addMoney', args: [-1] }))).status).toBe(400);
  });
  it('error responses never leak internals', async () => {
    const bad: Deps = mkDeps({ pool: () => { throw new Error('connect ECONNREFUSED postgres://user:hunter2@db'); } }); const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await handleState(req('/api/state', { tok: await token(A) }), bad); err.mockRestore();
    expect(r.status).toBe(500); expect(await r.text()).not.toMatch(/hunter2|ECONNREFUSED|postgres:/);
  });
  it('rate limit chat separately and return 429', async () => {
    const d = mkDeps({ chat: new RateLimiter(2, 60_000) }); const t = await token(B); const chat = () => handleRpcRequest(req('/api/rpc', { method: 'POST', body: JSON.stringify({ method: 'sendChat', args: ['what is an etf'] }), tok: t }), d);
    expect([(await chat()).status, (await chat()).status, (await chat()).status]).toEqual([200, 200, 429]);
  });
  it('cron needs the secret, and is off when none is configured', async () => {
    expect((await handleCron(req('/api/cron/daily'), deps)).status).toBe(401);
    expect((await handleCron(req('/api/cron/daily', { headers: { authorization: 'Bearer wrong-secret-value' } }), deps)).status).toBe(401);
    const ok = await handleCron(req('/api/cron/daily', { headers: { authorization: 'Bearer cron-secret-value' } }), deps); expect(ok.status).toBe(200);
    const off = mkDeps({ env: () => ({ SUPABASE_URL: undefined, SUPABASE_JWT_SECRET: SECRET, ANTHROPIC_API_KEY: undefined, ALLIE_MODEL: undefined, CRON_SECRET: undefined }) });
    expect((await handleCron(req('/api/cron/daily', { headers: { authorization: 'Bearer ' } }), off)).status).toBe(503);
  });
});

describe('the browser data layer against the real server code', () => {
  const remote = async (uid: string, onOut = () => {}) => { const t = await token(uid);
    const fetcher = (async (path: string, init: RequestInit) => { const r = new Request('http://app' + path, init); return path === '/api/state' ? handleState(r, deps) : path === '/api/rpc' ? handleRpcRequest(r, deps) : handleDeleteAccount(r, deps); }) as typeof fetch;
    return new RemoteData(async () => t, onOut, fetcher); };
  it('onboards, invests, and reads back through /api, with reads computed locally', async () => {
    const d = await remote(A); await d.load(); expect(d.state.profile.onboardedAt).toBeNull();
    await d.saveProfile({ riskTolerance: 4, horizonYears: 8, goals: ['Retirement'], step: 5 });
    await d.completeOnboarding({ amountCents: 10000, frequency: 'weekly', dayOfWeek: 2, dayOfMonth: null, start: '6m' });
    await d.investInPlaylist('p-smart', 5000);
    const h = d.home(); expect(h.rows.length).toBeGreaterThan(4); expect(h.valueCents).toBeGreaterThan(0); expect(d.series('All').length).toBeGreaterThan(50);
    const fresh = await remote(A); await fresh.load(); expect(fresh.state.orders.length).toBe(d.state.orders.length); expect(fresh.state.account.cashCents).toBe(d.state.account.cashCents);
  });
  it('shows a friendly error for a refused action and keeps the state', async () => {
    const d = await remote(A); await d.load(); const before = d.state.account.cashCents;
    await expect(d.addMoney(-5)).rejects.toThrow(/Invalid input/); expect(d.state.account.cashCents).toBe(before);
  });
  it('signs the user out when the server says the token is no longer valid', async () => {
    const out = vi.fn(); const d = new RemoteData(async () => 'garbage', out, (async (p: string, i: RequestInit) => handleState(new Request('http://app' + p, i), deps)) as typeof fetch);
    await expect(d.load()).rejects.toThrow(/sign in/i); expect(out).toHaveBeenCalled();
  });
  it('delete account needs explicit confirmation and removes everything', async () => {
    const t = await token(B);
    expect((await handleDeleteAccount(req('/api/account', { method: 'DELETE', body: '{}', tok: t }), deps)).status).toBe(400);
    expect((await handleDeleteAccount(req('/api/account', { method: 'DELETE', body: JSON.stringify({ confirm: true }), tok: t }), deps)).status).toBe(200);
    expect((await pool.query('select count(*)::int as n from auth.users where id = $1', [B])).rows[0].n).toBe(0);
    expect((await pool.query('select count(*)::int as n from chat_messages where user_id = $1', [B])).rows[0].n).toBe(0);
  });
});

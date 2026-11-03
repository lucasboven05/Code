import { z } from 'zod';
import { Service, type AllieFn } from '@/lib/data';
import { INSTRUMENTS } from '@/lib/seed';
import type { State } from '@/lib/types';
import type { Pool } from './db';
import { HttpError } from './http';
import { withUser } from './pgstore';

const id = z.string().uuid(); const tickers = new Set(INSTRUMENTS.map((i) => i.ticker));
const money = z.number().int().min(100).max(10_000_000);                       // $1.00 to $100,000.00 per action
const tz = z.string().max(60).refine((v) => { try { new Intl.DateTimeFormat('en', { timeZone: v }); return true; } catch { return false; } }, 'Unknown time zone');
const item = z.object({ ticker: z.string().refine((t) => tickers.has(t), 'Unknown investment'), weightBps: z.number().int().min(1).max(10000) }).strict();
const playlist = z.object({ name: z.string().trim().min(1).max(60), theme: z.string().max(30), description: z.string().max(140), isPublic: z.boolean(), items: z.array(item).min(1).max(30) }).strict();

/** One schema per callable method: unknown methods and unknown or malformed arguments are rejected before any work. */
const METHODS: Record<string, z.ZodType<unknown[]>> = {
  saveProfile: z.tuple([z.object({ displayName: z.string().max(40), birthYear: z.number().int().min(1930).max(2100).nullable(), riskTolerance: z.number().int().min(1).max(5).nullable(),
    horizonYears: z.number().int().min(1).max(80).nullable(), goals: z.array(z.string().max(40)).max(10), step: z.number().int().min(0).max(10) }).partial().strict()]),
  completeOnboarding: z.tuple([z.object({ amountCents: money, frequency: z.enum(['once', 'weekly', 'biweekly', 'monthly']), dayOfWeek: z.number().int().min(0).max(6).nullable(),
    dayOfMonth: z.number().int().min(1).max(28).nullable(), start: z.enum(['today', '6m', '1y']) }).strict()]),
  updateContribution: z.tuple([id, z.object({ amountCents: money, status: z.enum(['active', 'paused', 'cancelled']) }).partial().strict()]),
  createPlaylist: z.tuple([playlist]),
  updatePlaylist: z.tuple([id, playlist.partial()]),
  deletePlaylist: z.tuple([id]),
  investInPlaylist: z.tuple([z.string().min(1).max(40), money]),
  addMoney: z.tuple([money]),
  saveGoal: z.tuple([z.object({ id: id.optional(), name: z.string().trim().min(1).max(40), targetCents: z.number().int().min(100).max(1e12), targetYear: z.number().int().min(2000).max(2200) }).strict()]),
  deleteGoal: z.tuple([id]),
  sendChat: z.tuple([z.string().trim().min(1).max(500)]),
  addRecap: z.tuple([]),
  setPrefs: z.tuple([z.object({ dailyBriefing: z.boolean(), contributionDone: z.boolean(), rebalanceDone: z.boolean() }).partial().strict()]),
  setRebalance: z.tuple([z.boolean()]),
  setTimezone: z.tuple([tz]),
  resetAccount: z.tuple([]),
  deleteEverything: z.tuple([]),
};
export const RPC_METHODS = Object.keys(METHODS);

export type RpcDeps = { pool: Pool; userId: string; now?: () => Date; allie?: AllieFn };
export async function getState({ pool, userId, now, allie }: RpcDeps): Promise<State> {
  return withUser(pool, userId, async (store) => { const svc = new Service(store, now, allie); return svc.load(); });
}
export async function handleRpc(d: RpcDeps & { method: string; args: unknown }): Promise<State> {
  const schema = Object.prototype.hasOwnProperty.call(METHODS, d.method) ? METHODS[d.method] : null;
  if (!schema) throw new HttpError(400, 'Unknown action.');
  const parsed = schema.safeParse(d.args ?? []);
  if (!parsed.success) throw new HttpError(400, 'Invalid input: ' + parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.') || 'value'} ${i.message}`).join('; '));
  return withUser(d.pool, d.userId, async (store) => {
    const svc = new Service(store, d.now, d.allie); await svc.load();
    try { return await (svc as unknown as Record<string, (...a: unknown[]) => Promise<State>>)[d.method](...parsed.data); }
    catch (e) { throw new HttpError(400, e instanceof Error ? e.message : 'That did not work.'); }   // engine errors are user-facing ("Not enough cash")
  });
}

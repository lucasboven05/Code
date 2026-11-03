// HTTP handlers as plain (Request) => Response functions with injected dependencies, so they can be tested without Next.
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { authenticate } from './auth';
import { makeAllie } from './allie-llm';
import { runDaily } from './cron';
import type { Pool } from './db';
import type { env as envFn } from './env';
import { errorResponse, HttpError, json } from './http';
import { deleteAccount } from './pgstore';
import { RateLimiter } from './ratelimit';
import { getState, handleRpc } from './rpc';

export type Deps = { pool: () => Pool; env: () => ReturnType<typeof envFn>; now?: () => Date; general: RateLimiter; chat: RateLimiter };
const MAX_BODY = 20_000;
const allieFor = (e: ReturnType<typeof envFn>) => makeAllie({ apiKey: e.ANTHROPIC_API_KEY, model: e.ALLIE_MODEL });

async function readJson(req: Request): Promise<unknown> {
  const text = await req.text(); if (text.length > MAX_BODY) throw new HttpError(413, 'That request is too large.');
  try { return JSON.parse(text); } catch { throw new HttpError(400, 'Invalid request.'); }
}
export async function handleState(req: Request, d: Deps): Promise<Response> {
  try { const userId = await authenticate(req, d.env()); if (!d.general.take(userId)) throw new HttpError(429, 'Slow down a little and try again.');
    return json(await getState({ pool: d.pool(), userId, now: d.now, allie: allieFor(d.env()) })); } catch (e) { return errorResponse(e); }
}
export async function handleRpcRequest(req: Request, d: Deps): Promise<Response> {
  try {
    const userId = await authenticate(req, d.env());
    const body = z.object({ method: z.string().max(40), args: z.array(z.unknown()).max(5).optional() }).strict().safeParse(await readJson(req));
    if (!body.success) throw new HttpError(400, 'Invalid request.');
    if (!d.general.take(userId)) throw new HttpError(429, 'Slow down a little and try again.');
    if (body.data.method === 'sendChat' && !d.chat.take(userId)) throw new HttpError(429, 'Allie needs a short break. Try again in a minute.');
    return json(await handleRpc({ pool: d.pool(), userId, method: body.data.method, args: body.data.args ?? [], now: d.now, allie: allieFor(d.env()) }));
  } catch (e) { return errorResponse(e); }
}
export async function handleDeleteAccount(req: Request, d: Deps): Promise<Response> {
  try {
    const userId = await authenticate(req, d.env());
    const body = z.object({ confirm: z.literal(true) }).strict().safeParse(await readJson(req)); if (!body.success) throw new HttpError(400, 'Confirmation is required.');
    await deleteAccount(d.pool(), userId); return json({ ok: true });
  } catch (e) { return errorResponse(e); }
}
export async function handleCron(req: Request, d: Deps): Promise<Response> {
  try {
    const secret = d.env().CRON_SECRET; if (!secret) throw new HttpError(503, 'Scheduled jobs are not configured.');
    const got = Buffer.from(req.headers.get('authorization') ?? ''); const want = Buffer.from(`Bearer ${secret}`);
    if (got.length !== want.length || !timingSafeEqual(got, want)) throw new HttpError(401, 'Not allowed.');
    return json(await runDaily(d.pool(), d.now, allieFor(d.env())));
  } catch (e) { return errorResponse(e); }
}

import { env } from './env';
import { pgPool } from './db';
import { RateLimiter } from './ratelimit';
import type { Deps } from './handlers';
export const deps: Deps = { pool: () => pgPool(), env, general: new RateLimiter(120, 60_000), chat: new RateLimiter(15, 60_000) };

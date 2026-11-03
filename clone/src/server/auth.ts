import { createRemoteJWKSet, jwtVerify } from 'jose';
import { z } from 'zod';
import { HttpError } from './http';

const uuid = z.string().uuid();
export type AuthEnv = { SUPABASE_URL?: string; SUPABASE_JWT_SECRET?: string };
/**
 * Verifies a Supabase access token and returns the user's id (the token's `sub`). The id is the ONLY identity the
 * server trusts: no endpoint accepts a user id from the request body.
 * - Projects with a legacy shared secret: set SUPABASE_JWT_SECRET (HS256).
 * - Projects with signing keys: leave it unset; keys are fetched from SUPABASE_URL/auth/v1/.well-known/jwks.json.
 */
export async function verifyToken(token: string, env: AuthEnv): Promise<string> {
  try {
    const issuer = env.SUPABASE_URL ? `${env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1` : undefined;
    const opts = { audience: 'authenticated', ...(issuer ? { issuer } : {}) };
    const key = env.SUPABASE_JWT_SECRET ? new TextEncoder().encode(env.SUPABASE_JWT_SECRET) : jwks(env);
    const { payload } = await jwtVerify(token, key as any, { ...opts, algorithms: env.SUPABASE_JWT_SECRET ? ['HS256'] : ['ES256', 'RS256', 'EdDSA'] });
    return uuid.parse(payload.sub);
  } catch { throw new HttpError(401, 'Please sign in again.'); }
}
const cache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
function jwks(env: AuthEnv) {
  if (!env.SUPABASE_URL) throw new Error('SUPABASE_URL or SUPABASE_JWT_SECRET is required');
  const url = `${env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1/.well-known/jwks.json`;
  let k = cache.get(url); if (!k) { k = createRemoteJWKSet(new URL(url)); cache.set(url, k); } return k;
}
export async function authenticate(req: Request, env: AuthEnv): Promise<string> {
  const h = req.headers.get('authorization') ?? ''; const m = /^Bearer (.+)$/i.exec(h);
  if (!m) throw new HttpError(401, 'Please sign in.');
  return verifyToken(m[1], env);
}

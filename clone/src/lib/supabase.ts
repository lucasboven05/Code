import type { SupabaseClient } from '@supabase/supabase-js';
export const BACKEND_ON = process.env.NEXT_PUBLIC_BACKEND === 'supabase';
let client: SupabaseClient | null = null;
/** Browser-side client: used for sign-in only. All data goes through /api. */
export async function getSupabase(): Promise<SupabaseClient> {
  if (!client) {
    const { createClient } = await import('@supabase/supabase-js');   // loaded only when a backend is configured
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are not set');
    client = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  }
  return client;
}
export async function accessToken(): Promise<string | null> { const { data } = await (await getSupabase()).auth.getSession(); return data.session?.access_token ?? null; }
export async function signOut(everywhere = false) { await (await getSupabase()).auth.signOut({ scope: everywhere ? 'global' : 'local' }); }
export async function deleteMyAccount(): Promise<void> {
  const token = await accessToken(); if (!token) throw new Error('Please sign in again.');
  const r = await fetch('/api/account', { method: 'DELETE', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ confirm: true }) });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'Could not delete the account.');
  await signOut();
}

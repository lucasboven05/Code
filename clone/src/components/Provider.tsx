'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { LOCAL_KEY, LocalData, type Service } from '@/lib/data';
import { RemoteData } from '@/lib/remote';
import { BACKEND_ON, accessToken, getSupabase, signOut } from '@/lib/supabase';
import { SignIn } from './SignIn';
import { Skeleton } from './ui';
import type { State } from '@/lib/types';

type Toast = { msg: string; error: boolean } | null;
type Ctx = { data: Service; state: State; ready: boolean; toast: (m: string, error?: boolean) => void; act: <T>(p: Promise<T>, ok?: string) => Promise<T | null> };
const C = createContext<Ctx | null>(null);
export const useApp = () => { const c = useContext(C); if (!c) throw new Error('Provider missing'); return c; };

export function Provider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<'checking' | 'out' | 'in'>(BACKEND_ON ? 'checking' : 'in');
  const data = useMemo<Service>(() => (BACKEND_ON ? new RemoteData(accessToken, () => { signOut().catch(() => {}); }) : new LocalData()), []);
  const [state, setState] = useState<State>(data.state);
  const [ready, setReady] = useState(false);
  const [toastMsg, setToast] = useState<Toast>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const toast = useCallback((msg: string, error = false) => { setToast({ msg, error }); clearTimeout(timer.current); timer.current = setTimeout(() => setToast(null), 4000); }, []);
  useEffect(() => {
    if (!BACKEND_ON) return;
    let off = () => {}; let live = true;
    getSupabase().then((sb) => {
      if (!live) return; sb.auth.getSession().then(({ data: d }) => setAuth(d.session ? 'in' : 'out'));
      const { data: sub } = sb.auth.onAuthStateChange((_e, session) => setAuth(session ? 'in' : 'out')); off = () => sub.subscription.unsubscribe();
    }).catch(() => setAuth('out'));
    return () => { live = false; off(); };
  }, []);
  useEffect(() => {
    if (auth !== 'in') { if (auth === 'out') { setReady(false); } return; }
    let live = true; data.load().then((s) => { if (live) { setState(s); setReady(true); } }).catch((e) => { if (live) { setReady(true); toast(e instanceof Error ? e.message : 'Could not load your data.', true); } });
    return () => { live = false; };
  }, [auth, data, toast]);
  useEffect(() => {
    if (BACKEND_ON) return;
    const onStorage = (e: StorageEvent) => { if (e.key === LOCAL_KEY) (data as LocalData).reloadFromStore().then((s) => setState({ ...s })); };
    window.addEventListener('storage', onStorage); return () => window.removeEventListener('storage', onStorage);
  }, [data]);
  const act = useCallback(async <T,>(p: Promise<T>, ok?: string) => {
    try { const r = await p; if (r && typeof r === 'object' && 'v' in (r as object)) setState(r as unknown as State); if (ok) toast(ok); return r; }
    catch (e) { toast(e instanceof Error ? e.message : 'Something went wrong', true); return null; }
  }, [toast]);
  const body = auth === 'checking' ? <main className="page-plain"><Skeleton /></main> : auth === 'out' ? <SignIn /> : children;
  return (
    <C.Provider value={{ data, state, ready, toast, act }}>
      {body}
      {toastMsg && <div role="status" className={'toast' + (toastMsg.error ? ' toast-error' : '')}>{toastMsg.msg}</div>}
    </C.Provider>
  );
}

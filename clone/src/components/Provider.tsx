'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { LocalData } from '@/lib/data';
import type { State } from '@/lib/types';

type Toast = { msg: string; error: boolean } | null;
type Ctx = { data: LocalData; state: State; ready: boolean; toast: (m: string, error?: boolean) => void; act: <T>(p: Promise<T>, ok?: string) => Promise<T | null> };
const C = createContext<Ctx | null>(null);
export const useApp = () => { const c = useContext(C); if (!c) throw new Error('Provider missing'); return c; };

export function Provider({ children }: { children: React.ReactNode }) {
  const data = useMemo(() => new LocalData(), []);
  const [state, setState] = useState<State>(data.state);
  const [ready, setReady] = useState(false);
  const [toastMsg, setToast] = useState<Toast>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => { data.load().then((s) => { setState(s); setReady(true); }); }, [data]);
  const toast = useCallback((msg: string, error = false) => { setToast({ msg, error }); clearTimeout(timer.current); timer.current = setTimeout(() => setToast(null), 4000); }, []);
  const act = useCallback(async <T,>(p: Promise<T>, ok?: string) => {
    try { const r = await p; if (r && typeof r === 'object' && 'v' in (r as object)) setState(r as unknown as State); if (ok) toast(ok); return r; }
    catch (e) { toast(e instanceof Error ? e.message : 'Something went wrong', true); return null; }
  }, [toast]);
  return (
    <C.Provider value={{ data, state, ready, toast, act }}>
      {children}
      {toastMsg && <div role="status" className={'toast' + (toastMsg.error ? ' toast-error' : '')}>{toastMsg.msg}</div>}
    </C.Provider>
  );
}

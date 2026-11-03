import { useRef } from 'react';
/** Runs an async action at most once at a time. A second click that arrives before the first finishes is ignored.
 *  (A `busy` state variable is not enough: two fast clicks can both fire before React re-renders.) */
export function useLatch() {
  const on = useRef(false);
  return async function once<T>(fn: () => Promise<T>): Promise<T | undefined> {
    if (on.current) return undefined; on.current = true;
    try { return await fn(); } finally { on.current = false; }
  };
}

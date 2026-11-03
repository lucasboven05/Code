/** Fixed-window limiter. In-memory, so per server instance: enough to blunt a runaway client, not a distributed attack. */
export class RateLimiter {
  private hits = new Map<string, { n: number; reset: number }>();
  constructor(private max: number, private windowMs: number) {}
  take(key: string, now = Date.now()): boolean {
    const h = this.hits.get(key);
    if (!h || now >= h.reset) { this.hits.set(key, { n: 1, reset: now + this.windowMs }); if (this.hits.size > 5000) this.sweep(now); return true; }
    if (h.n >= this.max) return false; h.n += 1; return true;
  }
  private sweep(now: number) { for (const [k, v] of this.hits) if (now >= v.reset) this.hits.delete(k); }
}

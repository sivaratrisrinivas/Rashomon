/** Fixed-window limiter. In-memory, so it is per instance; fine for one API replica. */
export class RateLimiter {
  private hits = new Map<string, { count: number; reset: number }>();
  constructor(private limit: number, private windowMs: number) {}

  allow(key: string, multiplier = 1, now = Date.now()): boolean {
    const max = this.limit * multiplier;
    const entry = this.hits.get(key);
    if (!entry || now >= entry.reset) {
      this.hits.set(key, { count: 1, reset: now + this.windowMs });
      if (this.hits.size > 50_000) this.sweep(now);
      return true;
    }
    if (entry.count >= max) return false;
    entry.count++;
    return true;
  }

  private sweep(now: number) {
    for (const [k, v] of this.hits) if (now >= v.reset) this.hits.delete(k);
  }
}

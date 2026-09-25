// Token bucket spacing the calls to the translation service, which allows 5
// requests per minute per token. `capacity` calls may leave at once, then one
// every `intervalMs`. Pure: the clock and the sleep are injected, so the
// tests run without waiting.

export type Clock = { now: () => number; sleep: (ms: number) => Promise<void> };

export const realClock: Clock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

export class TokenBucket {
  private tokens: number;
  private updatedAt: number;
  private blockedUntil = 0;
  // Callers queue in order: the chain makes sure two waiting calls never
  // take the same token.
  private chain: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly capacity: number,
    private readonly intervalMs: number,
    private readonly clock: Clock = realClock,
  ) {
    this.tokens = capacity;
    this.updatedAt = clock.now();
  }

  private refill() {
    const now = this.clock.now();
    const earned = (now - this.updatedAt) / this.intervalMs;
    if (earned > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + earned);
      this.updatedAt = now;
    }
  }

  // Milliseconds before a token is available (0: one is available now).
  waitTime() {
    this.refill();
    const now = this.clock.now();
    const block = Math.max(0, this.blockedUntil - now);
    const missing = this.tokens >= 1 ? 0 : (1 - this.tokens) * this.intervalMs;
    return Math.ceil(Math.max(block, missing));
  }

  // Takes a token, waiting up to maxWaitMs. Resolves false when the wait
  // would be longer: the caller then degrades instead of hanging.
  acquire(maxWaitMs: number): Promise<boolean> {
    const run = async () => {
      const wait = this.waitTime();
      if (wait > maxWaitMs) return false;
      if (wait > 0) await this.clock.sleep(wait);
      this.refill();
      this.tokens = Math.max(0, this.tokens - 1);
      return true;
    };
    const result = this.chain.then(run, run);
    this.chain = result.catch(() => undefined);
    return result;
  }

  // The service answered "too many requests" or is down: nothing leaves
  // before `ms` has passed, and the bucket starts empty afterwards.
  block(ms: number) {
    this.blockedUntil = Math.max(this.blockedUntil, this.clock.now() + ms);
    this.tokens = 0;
    this.updatedAt = this.clock.now() + ms;
  }
}

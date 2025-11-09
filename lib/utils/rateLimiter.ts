export class RateLimiter {
  private capacity: number;
  private tokens: number;
  private refillIntervalMs: number;
  private lastRefill: number;

  constructor(capacity = 5, refillIntervalMs = 60_000) {
    this.capacity = capacity;
    this.tokens = capacity;
    this.refillIntervalMs = refillIntervalMs;
    this.lastRefill = Date.now();
  }

  private refill() {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    if (elapsed >= this.refillIntervalMs) {
      const cycles = Math.floor(elapsed / this.refillIntervalMs);
      this.tokens = Math.min(this.capacity, this.tokens + cycles * this.capacity);
      this.lastRefill += cycles * this.refillIntervalMs;
    }
  }

  take(): boolean {
    this.refill();
    if (this.tokens > 0) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }
}

// Singleton limiter for the API process
export const globalLimiter = new RateLimiter(5, 60_000);

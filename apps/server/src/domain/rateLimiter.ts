export class TokenBucket {
  private tokens: number;
  private lastRefillAt: number;

  constructor(
    private readonly ratePerSecond: number,
    private readonly burst: number,
  ) {
    this.tokens = burst;
    this.lastRefillAt = Date.now();
  }

  tryTake(now = Date.now()): boolean {
    const elapsedMs = now - this.lastRefillAt;
    if (elapsedMs > 0) {
      const refill = (elapsedMs / 1000) * this.ratePerSecond;
      this.tokens = Math.min(this.burst, this.tokens + refill);
      this.lastRefillAt = now;
    }

    if (this.tokens < 1) {
      return false;
    }

    this.tokens -= 1;
    return true;
  }
}

import { HttpException, HttpStatus } from "@nestjs/common";

const WINDOW_MS = Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS ?? 15 * 60 * 1000);
// Per account: stops password guessing on one user.
const MAX_FAILURES = Number(process.env.LOGIN_RATE_LIMIT_MAX_FAILURES ?? 10);
// Per IP: higher, because a whole school often shares one public IP.
const MAX_FAILURES_PER_IP = Number(process.env.LOGIN_RATE_LIMIT_MAX_FAILURES_PER_IP ?? 50);

type Bucket = { failures: number; firstFailureAt: number };

/**
 * Small in-memory brute-force guard for the login endpoint.
 * Keys on username and on client IP separately, so neither one can be hammered.
 * For multi-instance deployments, put a shared limiter (reverse proxy or Redis) in front.
 */
export class LoginRateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  assertAllowed(keys: string[]) {
    const now = Date.now();

    for (const key of keys) {
      const bucket = this.buckets.get(key);

      if (!bucket) {
        continue;
      }

      if (now - bucket.firstFailureAt > WINDOW_MS) {
        this.buckets.delete(key);
        continue;
      }

      const limit = key.startsWith("ip:") ? MAX_FAILURES_PER_IP : MAX_FAILURES;

      if (bucket.failures >= limit) {
        const retryAfterSeconds = Math.ceil((bucket.firstFailureAt + WINDOW_MS - now) / 1000);
        throw new HttpException(
          `Çok fazla başarısız giriş denemesi. ${Math.ceil(retryAfterSeconds / 60)} dakika sonra tekrar deneyin.`,
          HttpStatus.TOO_MANY_REQUESTS
        );
      }
    }
  }

  recordFailure(keys: string[]) {
    const now = Date.now();

    for (const key of keys) {
      const bucket = this.buckets.get(key);

      if (!bucket || now - bucket.firstFailureAt > WINDOW_MS) {
        this.buckets.set(key, { failures: 1, firstFailureAt: now });
      } else {
        bucket.failures += 1;
      }
    }

    if (this.buckets.size > 10_000) {
      this.prune(now);
    }
  }

  reset(keys: string[]) {
    keys.forEach((key) => this.buckets.delete(key));
  }

  private prune(now: number) {
    for (const [key, bucket] of this.buckets) {
      if (now - bucket.firstFailureAt > WINDOW_MS) {
        this.buckets.delete(key);
      }
    }
  }
}

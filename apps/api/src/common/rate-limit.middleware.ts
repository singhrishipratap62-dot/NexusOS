import { Injectable, NestMiddleware, HttpException, HttpStatus } from '@nestjs/common';

interface BucketEntry {
    tokens: number;
    lastRefill: number;
}

const DEFAULT_RATE = 60;   // requests per window
const DEFAULT_WINDOW = 60; // seconds

// Evict buckets that haven't been touched in this many ms (10 minutes).
// Prevents the Map from growing unbounded with one entry per unique tenant:method:path.
const EVICTION_TTL_MS = 10 * 60 * 1000;
// Run eviction at most once every 5 minutes to avoid per-request overhead.
const EVICTION_INTERVAL_MS = 5 * 60 * 1000;

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
    private readonly buckets = new Map<string, BucketEntry>();
    private readonly maxTokens: number;
    private readonly windowMs: number;
    private lastEviction = Date.now();

    constructor() {
        this.maxTokens = Number(process.env.RATE_LIMIT_MAX ?? DEFAULT_RATE);
        this.windowMs = Number(process.env.RATE_LIMIT_WINDOW_S ?? DEFAULT_WINDOW) * 1000;
    }

    use(req: any, _res: any, next: any): void {
        const tenantId = (req as any).tenantContext?.tenantId ?? req.ip ?? 'anonymous';
        const key = `${tenantId}:${req.method}:${req.baseUrl ?? req.path}`;
        const now = Date.now();

        // Periodically evict stale buckets to prevent unbounded Map growth.
        if (now - this.lastEviction > EVICTION_INTERVAL_MS) {
            this.evictStaleBuckets(now);
            this.lastEviction = now;
        }

        let bucket = this.buckets.get(key);
        if (!bucket) {
            bucket = { tokens: this.maxTokens, lastRefill: now };
            this.buckets.set(key, bucket);
        }

        // Refill tokens based on elapsed time
        const elapsed = now - bucket.lastRefill;
        if (elapsed > 0) {
            const refill = Math.floor((elapsed / this.windowMs) * this.maxTokens);
            bucket.tokens = Math.min(this.maxTokens, bucket.tokens + refill);
            bucket.lastRefill = now;
        }

        if (bucket.tokens <= 0) {
            throw new HttpException(
                { statusCode: 429, message: 'Too many requests. Please try again later.' },
                HttpStatus.TOO_MANY_REQUESTS
            );
        }

        bucket.tokens--;
        next();
    }

    private evictStaleBuckets(now: number): void {
        for (const [key, bucket] of this.buckets) {
            if (now - bucket.lastRefill > EVICTION_TTL_MS) {
                this.buckets.delete(key);
            }
        }
    }
}

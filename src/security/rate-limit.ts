import type { ExecutionContext, Middleware } from '../http/context.js';
import { DEFAULT_RATE_LIMIT_WINDOW, DEFAULT_RATE_LIMIT_MAX } from '../constants.js';

interface WindowEntry {
  count: number;
  windowStart: number;
}

export class RateLimitBuilder {
  private _windowMs = DEFAULT_RATE_LIMIT_WINDOW;
  private _max = DEFAULT_RATE_LIMIT_MAX;
  private _keyFn: ((ctx: ExecutionContext) => string) | null = null;
  private _message = 'Too Many Requests';
  private _cleanupIntervalMs = 0;

  windowMs(ms: number): this {
    this._windowMs = ms;
    return this;
  }

  max(requests: number): this {
    this._max = requests;
    return this;
  }

  keyBy(fn: (ctx: ExecutionContext) => string): this {
    this._keyFn = fn;
    return this;
  }

  message(msg: string): this {
    this._message = msg;
    return this;
  }

  cleanupInterval(ms: number): this {
    this._cleanupIntervalMs = ms;
    return this;
  }

  build(): Middleware {
    const store = new Map<string, WindowEntry>();
    const windowMs = this._windowMs;
    const max = this._max;
    const keyFn = this._keyFn;
    const message = this._message;

    let cleanupTimer: ReturnType<typeof setInterval> | null = null;
    const cleanupIntervalMs = this._cleanupIntervalMs || windowMs * 2;

    const startCleanup = (): void => {
      if (cleanupTimer) return;
      cleanupTimer = setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of store) {
          if (now - entry.windowStart >= windowMs) {
            store.delete(key);
          }
        }
        if (store.size === 0 && cleanupTimer) {
          clearInterval(cleanupTimer);
          cleanupTimer = null;
        }
      }, cleanupIntervalMs);
      cleanupTimer.unref?.();
    };

    return async (ctx: ExecutionContext, next: () => Promise<void>): Promise<void> => {
      const key = keyFn
        ? keyFn(ctx)
        : ctx.request.ip || ctx.request.headers['x-forwarded-for'] || 'unknown';

      const now = Date.now();
      let entry = store.get(key);

      if (!entry || now - entry.windowStart >= windowMs) {
        entry = { count: 0, windowStart: now };
        store.set(key, entry);
        startCleanup();
      }

      entry.count++;

      const remaining = Math.max(0, max - entry.count);
      const resetMs = entry.windowStart + windowMs - now;
      const retryAfter = Math.ceil(resetMs / 1000);

      ctx.response.header('X-RateLimit-Limit', String(max));
      ctx.response.header('X-RateLimit-Remaining', String(remaining));
      ctx.response.header('X-RateLimit-Reset', String(Math.ceil((entry.windowStart + windowMs) / 1000)));

      if (entry.count > max) {
        ctx.response.header('Retry-After', String(retryAfter));
        ctx.response.status(429).json({
          success: false,
          error: message,
          retryAfter,
        });
        return;
      }

      await next();
    };
  }
}

export function rateLimit(configure?: (builder: RateLimitBuilder) => void): Middleware {
  const builder = new RateLimitBuilder();
  if (configure) configure(builder);
  return builder.build();
}

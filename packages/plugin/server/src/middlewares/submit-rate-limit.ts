/**
 * Per-IP rate limit for the public submit endpoint.
 *
 * Defaults: 10 submissions per minute per (IP + form-slug). Defaults are
 * intentionally generous — most legitimate users submit one form once. A
 * higher tolerance gives a cushion for testing while still cutting off
 * automated abuse.
 *
 * Config (set in `config/plugins.ts` under `forms.config`):
 *   submitRateLimit: {
 *     enabled?: boolean       // default true; set false for tests
 *     windowMs?: number       // default 60_000 (1 minute)
 *     max?: number            // default 10 (per window per IP+slug)
 *   }
 *
 * Or as env vars:
 *   STRAPI_FORMS_RATELIMIT_ENABLED=false
 *   STRAPI_FORMS_RATELIMIT_WINDOW_MS=60000
 *   STRAPI_FORMS_RATELIMIT_MAX=10
 *
 * Implementation: a process-local LRU-ish Map. Survives nothing — restart
 * resets the counters. Fine for single-instance deployments. For
 * horizontally-scaled Strapi behind a load balancer, swap in a
 * Redis-backed store later (the existing `STRAPI_FORMS_REDIS_URL` for
 * BullMQ would be the natural place).
 */
import type { Core } from '@strapi/strapi';

type Bucket = { count: number; resetAt: number };

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX = 10;
const MAX_TRACKED_KEYS = 10_000; // hard cap; oldest entries get evicted

const readConfig = (strapi: Core.Strapi) => {
  const pluginConfig = (strapi.plugin('forms') as any)?.config ?? {};
  const cfg = pluginConfig.submitRateLimit ?? {};
  const envEnabled = process.env.STRAPI_FORMS_RATELIMIT_ENABLED;
  return {
    enabled:
      envEnabled !== undefined ? envEnabled !== 'false' : (cfg.enabled ?? true),
    windowMs: Number(
      process.env.STRAPI_FORMS_RATELIMIT_WINDOW_MS ?? cfg.windowMs ?? DEFAULT_WINDOW_MS
    ),
    max: Number(process.env.STRAPI_FORMS_RATELIMIT_MAX ?? cfg.max ?? DEFAULT_MAX),
  };
};

const clientIp = (ctx: any): string => {
  // Trust X-Forwarded-For when behind a proxy (Strapi defaults to trustProxy=false;
  // host project enables it in config/server.ts). Fall back to the socket address.
  const xff = ctx.request.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) {
    return xff.split(',')[0].trim();
  }
  return ctx.request.ip ?? ctx.req?.socket?.remoteAddress ?? 'unknown';
};

export default (_config: unknown, { strapi }: { strapi: Core.Strapi }) => {
  const buckets = new Map<string, Bucket>();

  return async (ctx: any, next: () => Promise<any>) => {
    const { enabled, windowMs, max } = readConfig(strapi);
    if (!enabled) return next();

    // Only enforce on the submit route. Schema / embed.js are read-only.
    if (!ctx.path.endsWith('/submit')) return next();

    const slug = ctx.params?.slug ?? 'unknown';
    const key = `${clientIp(ctx)}::${slug}`;
    const now = Date.now();

    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;

    // LRU-ish eviction — when we cross the cap, drop ~10% of the oldest
    // entries. Map iteration order is insertion order, so the first keys
    // are the oldest.
    if (buckets.size > MAX_TRACKED_KEYS) {
      const drop = Math.floor(MAX_TRACKED_KEYS * 0.1);
      let i = 0;
      for (const k of buckets.keys()) {
        buckets.delete(k);
        if (++i >= drop) break;
      }
    }

    const remaining = Math.max(0, max - bucket.count);
    ctx.set('X-RateLimit-Limit', String(max));
    ctx.set('X-RateLimit-Remaining', String(remaining));
    ctx.set('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > max) {
      const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      ctx.set('Retry-After', String(retryAfterSec));
      ctx.status = 429;
      ctx.body = {
        error: {
          status: 429,
          name: 'TooManyRequests',
          message: `Too many submissions. Try again in ${retryAfterSec}s.`,
        },
      };
      return;
    }

    return next();
  };
};

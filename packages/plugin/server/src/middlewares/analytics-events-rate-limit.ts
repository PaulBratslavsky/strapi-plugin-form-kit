/**
 * Per-IP rate limit for the public analytics ingest endpoint
 * (`POST /api/forms/:slug/events`).
 *
 * Separate from `submit-rate-limit` because the budgets are different: a single
 * legitimate form fill fires a burst (view + start + several field_changes +
 * submit_attempt), so this allows ~100/min per (IP, form) by default vs
 * submit's 10/min. The per-session 100-event hard cap (see analytics/ingest.ts)
 * is the second line of defence; sampling is a future knob.
 *
 * Budget comes from the analytics service config (`analytics.eventsRateLimit`,
 * or STRAPI_FORMS_ANALYTICS_RATELIMIT_{MAX,WINDOW_MS}).
 */
import type { Core } from '@strapi/strapi';

type Bucket = { count: number; resetAt: number };

const MAX_TRACKED_KEYS = 20_000;

const clientIp = (ctx: any): string => {
  const xff = ctx.request.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) return xff.split(',')[0].trim();
  return ctx.request.ip ?? ctx.req?.socket?.remoteAddress ?? 'unknown';
};

export default (_config: unknown, { strapi }: { strapi: Core.Strapi }) => {
  const buckets = new Map<string, Bucket>();

  return async (ctx: any, next: () => Promise<any>) => {
    if (!ctx.path.endsWith('/events')) return next();

    const analytics = strapi.plugin('forms').service('analytics');
    const cfg = analytics?.config?.();
    if (!cfg || !cfg.enabled) {
      // Analytics off → swallow the request cheaply; nothing will be recorded.
      ctx.status = 204;
      return;
    }
    const { max, windowMs } = cfg.eventsRateLimit;

    const slug = ctx.params?.slug ?? 'unknown';
    const key = `${clientIp(ctx)}::${slug}`;
    const now = Date.now();

    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;

    if (buckets.size > MAX_TRACKED_KEYS) {
      const drop = Math.floor(MAX_TRACKED_KEYS * 0.1);
      let i = 0;
      for (const k of buckets.keys()) {
        buckets.delete(k);
        if (++i >= drop) break;
      }
    }

    if (bucket.count > max) {
      const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      ctx.set('Retry-After', String(retryAfterSec));
      ctx.status = 429;
      ctx.body = { error: { status: 429, name: 'TooManyRequests', message: 'Too many events.' } };
      return;
    }

    return next();
  };
};

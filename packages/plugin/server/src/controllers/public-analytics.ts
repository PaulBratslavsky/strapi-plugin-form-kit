import type { Core } from '@strapi/strapi';
import { findPublishedFormByIdOrSlug } from './shared/form-lookup';
import { parseBatch } from '../services/analytics/ingest';

/**
 * Public analytics ingest. `POST /api/forms/:slug/events` — the embed posts
 * batched events here via sendBeacon. Always answers 204 quickly: analytics is
 * best-effort, so an unknown form, a disabled-per-form toggle, or a malformed
 * body all resolve to "no content" rather than an error the page would surface.
 */
const controller = ({ strapi }: { strapi: Core.Strapi }) => ({
  async track(ctx: any) {
    // Reply first; never let analytics work block or error the beacon.
    ctx.status = 204;

    const batch = parseBatch(ctx.request.body);
    if (!batch) return;

    const form = await findPublishedFormByIdOrSlug(strapi, ctx.params.slug);
    if (!form) return;

    // Per-form opt-out for GDPR-strict forms (default on).
    if (form.schema?.settings?.analytics?.enabled === false) return;

    const referrer =
      ctx.request.headers.referer ?? ctx.request.headers.referrer ?? null;

    try {
      await strapi.plugin('forms').service('analytics').record(form.documentId, batch, {
        ip: ctx.request.ip,
        userAgent: ctx.request.headers['user-agent'] ?? null,
        referrer: typeof referrer === 'string' ? referrer.slice(0, 500) : null,
      });
    } catch (err) {
      strapi.log.warn(`[strapi-plugin-forms] analytics ingest failed: ${(err as Error).message}`);
    }
  },
});

export default controller;

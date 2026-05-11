/**
 * Single entry point for the webhook dispatcher service. Picks BullMQ vs inline at
 * `init()` based on the `STRAPI_FORMS_REDIS_URL` env var (or plugin config equivalent).
 *
 * The selected implementation is hidden behind the WebhookDispatcher interface — the
 * rest of the codebase never sees which mode is active.
 */
import type { Core } from '@strapi/strapi';
import { createInlineDispatcher } from './inline';
import { createBullMQDispatcher } from './bullmq';
import type { WebhookDispatcher } from './types';

const service = ({ strapi }: { strapi: Core.Strapi } = { strapi: undefined as any }): WebhookDispatcher => {
  const $strapi: Core.Strapi = strapi ?? (globalThis as any).strapi;

  let inner: WebhookDispatcher | null = null;

  const ensure = (): WebhookDispatcher => {
    if (inner) return inner;
    const cfg = $strapi.plugin('forms').config;
    const redisUrl = process.env.STRAPI_FORMS_REDIS_URL ?? cfg?.('redisUrl');
    const retryMax = Number(
      process.env.STRAPI_FORMS_WEBHOOK_RETRY_MAX ?? cfg?.('webhookRetryMax') ?? 5
    );
    const hmacDefaultSecret =
      process.env.STRAPI_FORMS_WEBHOOK_HMAC_DEFAULT_SECRET ?? cfg?.('webhookHmacDefaultSecret');

    if (redisUrl) {
      inner = createBullMQDispatcher({ strapi: $strapi, retryMax, hmacDefaultSecret, redisUrl });
    } else {
      inner = createInlineDispatcher({ strapi: $strapi, retryMax, hmacDefaultSecret });
    }
    return inner;
  };

  return {
    async init() {
      const i = ensure();
      await i.init?.();
    },
    async shutdown() {
      if (inner) await inner.shutdown?.();
      inner = null;
    },
    async dispatch(args) {
      return ensure().dispatch(args);
    },
    async dispatchAllForSubmission(args) {
      return ensure().dispatchAllForSubmission(args);
    },
    async getRecentDeliveries(args) {
      return ensure().getRecentDeliveries(args);
    },
  };
};

export default service;
export { computeBackoffMs } from './delivery';

/**
 * Inline dispatcher — used when STRAPI_FORMS_REDIS_URL is not set.
 *
 * Uses setTimeout-based exponential backoff. NOT durable across Strapi restarts:
 * pending retries are lost. This mode prints a warning at bootstrap.
 */
import type { DispatcherDeps, WebhookDispatcher } from './types';
import { computeBackoffMs, performDelivery } from './delivery';
import { TABLE_NAMES } from '../../database/migrations/0001-create-delivery-logs';

export const createInlineDispatcher = (deps: DispatcherDeps): WebhookDispatcher => {
  const { strapi, retryMax } = deps;

  const trySend = async (
    webhookConfigId: number,
    submissionId: number,
    payload: object,
    attemptNumber: number
  ): Promise<void> => {
    const outcome = await performDelivery({
      strapi,
      webhookConfigId,
      submissionId,
      attemptNumber,
      payload,
    });

    if (outcome.ok || !outcome.retry || attemptNumber >= retryMax) return;

    const delay = computeBackoffMs(attemptNumber);
    setTimeout(() => {
      void trySend(webhookConfigId, submissionId, payload, attemptNumber + 1).catch((err) => {
        strapi.log.warn(`[strapi-plugin-forms] inline retry crashed: ${err.message}`);
      });
    }, delay).unref?.();
  };

  return {
    async init() {
      strapi.log.warn(
        '[strapi-plugin-forms] STRAPI_FORMS_REDIS_URL not set — using inline webhook dispatcher (pending retries lost on restart). For production set STRAPI_FORMS_REDIS_URL.'
      );
    },

    async shutdown() {
      // setTimeouts are unrefed; no explicit shutdown.
    },

    async dispatch({ webhookConfigId, submissionId, payload }) {
      // Fire-and-forget; errors logged inside trySend.
      void trySend(webhookConfigId, submissionId, payload, 1);
    },

    async dispatchAllForSubmission({ formDocumentId, submissionId, payload }) {
      const form = await strapi
        .documents('plugin::forms.form')
        .findOne({ documentId: formDocumentId, status: 'draft' as any } as any);
      if (!form) return;
      const configs = await strapi.entityService.findMany('plugin::forms.webhook-config' as any, {
        filters: { form: { documentId: form.documentId }, enabled: true },
      } as any);
      for (const cfg of configs as any[]) {
        await this.dispatch({ webhookConfigId: cfg.id, submissionId, payload });
      }
    },

    async getRecentDeliveries({ webhookConfigId, limit = 50 }) {
      return (await strapi.db
        .connection(TABLE_NAMES.WEBHOOK)
        .where('webhook_config_id', webhookConfigId)
        .orderBy('attempted_at', 'desc')
        .limit(limit)) as any;
    },
  };
};

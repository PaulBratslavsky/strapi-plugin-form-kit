/**
 * Shared HTTP delivery + logging used by both BullMQ and Inline dispatchers.
 * Keeping this in one place means both modes have identical observable behavior.
 */
import crypto from 'node:crypto';
import { v4 as uuid } from 'uuid';
import type { Core } from '@strapi/strapi';
import { TABLE_NAMES } from '../../database/migrations/0001-create-delivery-logs';
import { decrypt } from '../../utils/encryption';

export type DeliveryArgs = {
  strapi: Core.Strapi;
  webhookConfigId: number;
  submissionId: number;
  attemptNumber: number;
  payload: object;
};

export type DeliveryOutcome = {
  ok: boolean;
  retry: boolean;
  status: 'success' | 'failed' | 'error';
  httpStatus?: number;
  errorMessage?: string;
  responseBodyPreview?: string;
  durationMs: number;
};

const isRetryableStatus = (s: number) => s === 408 || s === 429 || (s >= 500 && s <= 599);

export const performDelivery = async (args: DeliveryArgs): Promise<DeliveryOutcome> => {
  const { strapi } = args;
  const config = await strapi.entityService.findOne(
    'plugin::forms.webhook-config' as any,
    args.webhookConfigId
  );
  if (!config) {
    return {
      ok: false,
      retry: false,
      status: 'error',
      errorMessage: 'webhook-config not found',
      durationMs: 0,
    };
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'strapi-plugin-forms/0.1',
    ...((config as any).headers ?? {}),
  };

  const body = JSON.stringify(args.payload);

  if ((config as any).hmacSecretEncrypted) {
    try {
      const secret = decrypt((config as any).hmacSecretEncrypted);
      const hmac = crypto.createHmac('sha256', secret).update(body).digest('hex');
      headers['X-Strapi-Forms-Signature'] = `sha256=${hmac}`;
    } catch (err) {
      strapi.log.warn(
        `[strapi-plugin-forms] could not decrypt HMAC secret for webhook ${args.webhookConfigId}: ${(err as Error).message}`
      );
    }
  }

  const started = Date.now();
  let outcome: DeliveryOutcome;

  try {
    const res = await fetch((config as any).url, {
      method: (config as any).method ?? 'POST',
      headers,
      body,
    });
    const text = await res.text().catch(() => '');
    const preview = text.slice(0, 1024);
    const ok = res.status >= 200 && res.status < 300;
    outcome = {
      ok,
      retry: !ok && isRetryableStatus(res.status),
      status: ok ? 'success' : 'failed',
      httpStatus: res.status,
      responseBodyPreview: preview,
      durationMs: Date.now() - started,
    };
  } catch (err) {
    outcome = {
      ok: false,
      retry: true,
      status: 'error',
      errorMessage: (err as Error).message,
      durationMs: Date.now() - started,
    };
  }

  // Log the attempt.
  try {
    await strapi.db.connection(TABLE_NAMES.WEBHOOK).insert({
      id: uuid(),
      webhook_config_id: args.webhookConfigId,
      submission_id: args.submissionId,
      attempt_number: args.attemptNumber,
      status: outcome.status,
      http_status: outcome.httpStatus ?? null,
      response_body_preview: outcome.responseBodyPreview ?? null,
      error_message: outcome.errorMessage ?? null,
      attempted_at: new Date(),
      duration_ms: outcome.durationMs,
    });
  } catch (err) {
    strapi.log.warn(
      `[strapi-plugin-forms] could not write webhook delivery log: ${(err as Error).message}`
    );
  }

  return outcome;
};

export const computeBackoffMs = (attemptNumber: number): number => {
  // Exponential backoff: 1s, 2s, 4s, 8s, 16s, capped at 60s.
  const base = 1000;
  return Math.min(base * 2 ** (attemptNumber - 1), 60_000);
};

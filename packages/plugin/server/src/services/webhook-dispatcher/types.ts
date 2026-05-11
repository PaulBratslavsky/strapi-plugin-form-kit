import type { Core } from '@strapi/strapi';

export type DispatchArgs = {
  webhookConfigId: number;
  submissionId: number;
  payload: object;
};

export type WebhookDeliveryLogEntry = {
  id: string;
  webhook_config_id: number;
  submission_id: number;
  attempt_number: number;
  status: 'pending' | 'success' | 'failed' | 'error';
  http_status: number | null;
  response_body_preview: string | null;
  error_message: string | null;
  attempted_at: string;
  duration_ms: number | null;
};

export interface WebhookDispatcher {
  init?: () => Promise<void>;
  shutdown?: () => Promise<void>;
  /**
   * Schedule a webhook delivery. May execute immediately (inline) or enqueue (BullMQ).
   * Errors are logged to strapi_forms_webhook_delivery_log; never thrown.
   */
  dispatch(args: DispatchArgs): Promise<void>;
  dispatchAllForSubmission(args: { formDocumentId: string; submissionId: number; payload: object }): Promise<void>;
  getRecentDeliveries(args: {
    webhookConfigId: number;
    limit?: number;
  }): Promise<WebhookDeliveryLogEntry[]>;
}

export type DispatcherDeps = {
  strapi: Core.Strapi;
  retryMax: number;
  hmacDefaultSecret?: string;
};

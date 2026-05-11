/**
 * BullMQ dispatcher — used when STRAPI_FORMS_REDIS_URL is set. Pending retries survive
 * Strapi restarts (BullMQ persists job state in Redis). The Worker runs in the same Strapi
 * process for v1; can be split into a dedicated worker process later.
 */
import { Queue, Worker, type ConnectionOptions } from 'bullmq';
import type { DispatcherDeps, WebhookDispatcher } from './types';
import { performDelivery, computeBackoffMs } from './delivery';
import { TABLE_NAMES } from '../../database/migrations/0001-create-delivery-logs';

const QUEUE_NAME = 'strapi-forms-webhooks';

type JobData = {
  webhookConfigId: number;
  submissionId: number;
  attemptNumber: number;
  payload: object;
};

export const createBullMQDispatcher = (deps: DispatcherDeps & { redisUrl: string }): WebhookDispatcher => {
  const { strapi, retryMax, redisUrl } = deps;

  const url = new URL(redisUrl);
  const connection: ConnectionOptions = {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    db: url.pathname && url.pathname !== '/' ? Number(url.pathname.slice(1)) : 0,
  };

  let queue: Queue<JobData> | null = null;
  let worker: Worker<JobData> | null = null;

  return {
    async init() {
      queue = new Queue<JobData>(QUEUE_NAME, {
        connection,
        defaultJobOptions: { removeOnComplete: 1000, removeOnFail: 1000 },
      });
      worker = new Worker<JobData>(
        QUEUE_NAME,
        async (job) => {
          const outcome = await performDelivery({
            strapi,
            webhookConfigId: job.data.webhookConfigId,
            submissionId: job.data.submissionId,
            attemptNumber: job.data.attemptNumber,
            payload: job.data.payload,
          });

          if (outcome.ok) return;
          if (!outcome.retry || job.data.attemptNumber >= retryMax) {
            // Don't throw — we already logged the failure outcome ourselves.
            return;
          }

          await queue!.add(
            'deliver',
            {
              ...job.data,
              attemptNumber: job.data.attemptNumber + 1,
            },
            { delay: computeBackoffMs(job.data.attemptNumber) }
          );
        },
        { connection, concurrency: 4 }
      );

      worker.on('failed', (_job, err) => {
        strapi.log.warn(`[strapi-plugin-forms] webhook job failed: ${err.message}`);
      });

      strapi.log.info('[strapi-plugin-forms] BullMQ webhook dispatcher initialised');
    },

    async shutdown() {
      await Promise.allSettled([worker?.close(), queue?.close()]);
    },

    async dispatch({ webhookConfigId, submissionId, payload }) {
      if (!queue) return;
      await queue.add(
        'deliver',
        { webhookConfigId, submissionId, attemptNumber: 1, payload },
        { attempts: 1 }
      );
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

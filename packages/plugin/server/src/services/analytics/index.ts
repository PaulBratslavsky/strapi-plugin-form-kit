/**
 * Analytics service. Owns config, the event-write path, the dashboard read, and
 * the rollup scheduler.
 *
 * Scheduler note: v1 uses a process-local `setInterval`, not BullMQ, even when
 * Redis is set. Rollups upsert on (form, day) and are fully idempotent, so a
 * second Strapi instance running its own ticks converges to identical rows —
 * the worst case is duplicated compute, never wrong data. Moving rollup
 * scheduling onto BullMQ (to dedupe that compute in horizontally-scaled
 * deployments) is a follow-up; it doesn't change correctness.
 */
import { randomBytes } from 'node:crypto';
import type { Core } from '@strapi/strapi';
import { v4 as uuid } from 'uuid';
import { TABLE_NAMES } from '../../database/migrations/0002-create-analytics';
import { hashIp, MAX_EVENTS_PER_SESSION } from './ingest';
import { getReport, runRollupTick } from './rollup';
import { dayKey } from './aggregate';
import type { AnalyticsReport, EventBatch } from './types';

const { EVENTS } = TABLE_NAMES;

const ROLLUP_INTERVAL_MS = 5 * 60 * 1000;
const DEFAULT_RETENTION_DAYS = 30;
const DEFAULT_EVENTS_MAX = 100;
const DEFAULT_EVENTS_WINDOW_MS = 60_000;

const envBool = (v: string | undefined, fallback: boolean): boolean =>
  v === undefined ? fallback : v !== 'false';

type AnalyticsConfig = {
  enabled: boolean;
  retentionDays: number;
  salt: string;
  anonymizeIpsFully: boolean;
  eventsRateLimit: { max: number; windowMs: number };
};

// Per-process random salt fallback — fine for a single instance. Set
// STRAPI_FORMS_ANALYTICS_SALT for stable hashing across instances/restarts.
const PROCESS_SALT = randomBytes(16).toString('hex');

const service = ({ strapi }: { strapi: Core.Strapi } = { strapi: undefined as any }) => {
  const $strapi: Core.Strapi = strapi ?? (globalThis as any).strapi;
  let timer: ReturnType<typeof setInterval> | null = null;

  const readConfig = (): AnalyticsConfig => {
    const cfg = ($strapi.plugin('forms') as any)?.config ?? {};
    const a = cfg.analytics ?? {};
    const rl = a.eventsRateLimit ?? {};
    return {
      enabled: envBool(process.env.STRAPI_FORMS_ANALYTICS_ENABLED, a.enabled ?? true),
      retentionDays: Number(
        process.env.STRAPI_FORMS_ANALYTICS_RETENTION_DAYS ??
          a.retentionDays ??
          DEFAULT_RETENTION_DAYS
      ),
      salt: process.env.STRAPI_FORMS_ANALYTICS_SALT ?? a.salt ?? PROCESS_SALT,
      anonymizeIpsFully: envBool(
        process.env.STRAPI_FORMS_ANALYTICS_ANONYMIZE_IPS_FULLY,
        a.anonymizeIpsFully ?? false
      ),
      eventsRateLimit: {
        max: Number(process.env.STRAPI_FORMS_ANALYTICS_RATELIMIT_MAX ?? rl.max ?? DEFAULT_EVENTS_MAX),
        windowMs: Number(
          process.env.STRAPI_FORMS_ANALYTICS_RATELIMIT_WINDOW_MS ??
            rl.windowMs ??
            DEFAULT_EVENTS_WINDOW_MS
        ),
      },
    };
  };

  return {
    config: readConfig,

    async init() {
      const cfg = readConfig();
      if (!cfg.enabled) {
        $strapi.log.debug('[strapi-plugin-forms] analytics disabled; rollup scheduler not started');
        return;
      }
      // Fire once shortly after boot, then on the interval. unref so it never
      // keeps the process alive on its own.
      timer = setInterval(() => {
        void runRollupTick($strapi, { retentionDays: cfg.retentionDays }).catch((err) => {
          $strapi.log.warn(`[strapi-plugin-forms] analytics rollup failed: ${(err as Error).message}`);
        });
      }, ROLLUP_INTERVAL_MS);
      timer.unref?.();
    },

    async shutdown() {
      if (timer) clearInterval(timer);
      timer = null;
    },

    /**
     * Persist a validated batch of events. `meta` carries server-derived
     * context (resolved form, client ip, headers). Best-effort: never throws
     * to the caller — analytics must not break the page.
     */
    async record(
      formDocumentId: string,
      batch: EventBatch,
      meta: { ip: string; userAgent: string | null; referrer: string | null }
    ): Promise<void> {
      const cfg = readConfig();
      if (!cfg.enabled || batch.preview) return;

      const ipHash = hashIp(meta.ip, {
        salt: cfg.salt,
        anonymizeFully: cfg.anonymizeIpsFully,
        day: dayKey(new Date()),
      });
      const now = new Date();
      const rows = batch.events.slice(0, MAX_EVENTS_PER_SESSION).map((e) => ({
        id: uuid(),
        form_document_id: formDocumentId,
        session_id: batch.sessionId,
        type: e.type,
        field_id: e.fieldId ?? null,
        error_kind: e.errorKind ?? null,
        ip_hash: ipHash,
        user_agent: meta.userAgent,
        referrer: meta.referrer,
        viewport: batch.viewport ?? null,
        created_at: now,
      }));
      if (rows.length === 0) return;
      await $strapi.db.connection(EVENTS).insert(rows);
    },

    async getReport(
      formDocumentId: string,
      fromDay: string,
      toDay: string,
      fieldLabels: Record<string, string> = {}
    ): Promise<AnalyticsReport> {
      return getReport($strapi, formDocumentId, fromDay, toDay, fieldLabels);
    },
  };
};

export default service;

/**
 * DB-bound half of analytics: load raw events + submissions, aggregate, seal
 * completed days into the rollups table, prune past the retention window.
 *
 * The read path computes the unsealed tail (typically just today) live and
 * reads rollups for sealed days, so the dashboard is correct even if a rollup
 * tick is late or hasn't run yet. Rollups are a speed/retention optimisation,
 * never the only source of truth.
 */
import type { Core } from '@strapi/strapi';
import { v4 as uuid } from 'uuid';
import { TABLE_NAMES } from '../../database/migrations/0002-create-analytics';
import { aggregateEvents, dayKey, toReport } from './aggregate';
import type { AnalyticsReport, DayMetrics, EventRow, SubmissionRef } from './types';

const { EVENTS, ROLLUPS } = TABLE_NAMES;

const startOfUtcDay = (d: Date): Date =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

const addDays = (d: Date, n: number): Date => {
  const c = new Date(d);
  c.setUTCDate(c.getUTCDate() + n);
  return c;
};

/** Load raw events + submissions for a form/range and aggregate per day. */
const loadDays = async (
  strapi: Core.Strapi,
  formDocumentId: string,
  from: Date,
  to: Date
): Promise<DayMetrics[]> => {
  const knex = strapi.db.connection;
  const events: EventRow[] = await knex(EVENTS)
    .where('form_document_id', formDocumentId)
    .andWhere('created_at', '>=', from)
    .andWhere('created_at', '<', to)
    .select('form_document_id', 'session_id', 'type', 'field_id', 'error_kind', 'created_at');

  const submissionRows = (await strapi.entityService.findMany(
    'plugin::forms.submission' as any,
    {
      filters: {
        form: { documentId: formDocumentId },
        status: 'submitted',
        createdAt: { $gte: from, $lt: to },
      },
      fields: ['createdAt'],
      populate: {},
      pagination: { page: 1, pageSize: 10000 },
    } as any
  )) as any[];
  const submissions: SubmissionRef[] = submissionRows.map((s) => ({
    sessionId: (s.metadata as any)?.sessionId ?? null,
    createdAt: s.createdAt,
  }));

  return aggregateEvents(events, submissions);
};

const rollupRowToDayMetrics = (row: any): DayMetrics => ({
  day: row.day,
  views: row.views ?? 0,
  starts: row.starts ?? 0,
  attempts: row.attempts ?? 0,
  submits: row.submits ?? 0,
  avgSeconds: row.avg_seconds ?? null,
  dropoffByField:
    typeof row.dropoff_by_field === 'string'
      ? JSON.parse(row.dropoff_by_field)
      : (row.dropoff_by_field ?? []),
});

const dayMetricsToRollupRow = (formDocumentId: string, m: DayMetrics) => ({
  form_document_id: formDocumentId,
  day: m.day,
  views: m.views,
  starts: m.starts,
  attempts: m.attempts,
  submits: m.submits,
  avg_seconds: m.avgSeconds,
  dropoff_by_field: JSON.stringify(m.dropoffByField),
  updated_at: new Date(),
});

/**
 * Build the admin report for a form over a day range. Sealed days come from
 * the rollups table; any day in range without a rollup row is computed live
 * from raw events (so today and not-yet-sealed days are always accurate).
 */
export const getReport = async (
  strapi: Core.Strapi,
  formDocumentId: string,
  fromDay: string,
  toDay: string,
  fieldLabels: Record<string, string> = {}
): Promise<AnalyticsReport> => {
  const knex = strapi.db.connection;
  const from = new Date(`${fromDay}T00:00:00.000Z`);
  const toExclusive = addDays(new Date(`${toDay}T00:00:00.000Z`), 1);

  const rollupRows: any[] = await knex(ROLLUPS)
    .where('form_document_id', formDocumentId)
    .andWhere('day', '>=', fromDay)
    .andWhere('day', '<=', toDay);
  const sealed = new Set<string>(rollupRows.map((r) => r.day));

  const live = await loadDays(strapi, formDocumentId, from, toExclusive);

  const merged: DayMetrics[] = [
    ...rollupRows.map(rollupRowToDayMetrics),
    ...live.filter((m) => !sealed.has(m.day)),
  ];

  return toReport(merged, { from: fromDay, to: toDay }, fieldLabels);
};

/**
 * Seal completed days into the rollups table and prune events past retention.
 * Idempotent: upserts on (form_document_id, day), so a re-run (or a second
 * Strapi instance running its own scheduler) converges to the same rows.
 */
export const runRollupTick = async (
  strapi: Core.Strapi,
  opts: { retentionDays: number }
): Promise<void> => {
  const knex = strapi.db.connection;
  const now = new Date();
  const todayStart = startOfUtcDay(now);
  const retentionStart = addDays(todayStart, -opts.retentionDays);
  // Re-seal the last couple of completed days each tick — abandon attribution
  // only stabilises after the 30-min idle timeout, and late events trickle in.
  const reSealFrom = dayKey(addDays(todayStart, -2));

  const forms: { form_document_id: string }[] = await knex(EVENTS)
    .where('created_at', '<', todayStart)
    .andWhere('created_at', '>=', retentionStart)
    .distinct('form_document_id');

  for (const { form_document_id } of forms) {
    const existing: any[] = await knex(ROLLUPS)
      .where('form_document_id', form_document_id)
      .pluck('day');
    const sealed = new Set<string>(existing);

    const days = await loadDays(strapi, form_document_id, retentionStart, todayStart);
    for (const m of days) {
      if (m.day >= reSealFrom || !sealed.has(m.day)) {
        await knex(ROLLUPS)
          .insert({ id: uuid(), ...dayMetricsToRollupRow(form_document_id, m) })
          .onConflict(['form_document_id', 'day'])
          .merge();
      }
    }
  }

  await knex(EVENTS).where('created_at', '<', retentionStart).del();
};

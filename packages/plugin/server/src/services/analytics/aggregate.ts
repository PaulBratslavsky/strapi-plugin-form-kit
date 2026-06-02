/**
 * Pure analytics aggregation — no DB, no Strapi. Given raw event rows and the
 * submissions they may have produced, compute per-day metrics and merge them
 * into a report. Kept side-effect-free so it's the single source of truth for
 * both the rollup worker (seals one day at a time) and the admin live read
 * (computes the unsealed tail), and so it's trivially unit-testable.
 */
import type {
  AnalyticsReport,
  DayMetrics,
  EventRow,
  FieldDropoff,
  SubmissionRef,
} from './types';

/** UTC calendar day key, 'YYYY-MM-DD'. */
export const dayKey = (d: string | Date): string => {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toISOString().slice(0, 10);
};

const ms = (d: string | Date): number =>
  (typeof d === 'string' ? new Date(d) : d).getTime();

type SessionAgg = {
  view: boolean;
  start: boolean;
  attempt: boolean;
  firstStartMs: number | null;
  touchedFields: Set<string>;
  lastTouchField: string | null;
  lastTouchMs: number;
};

/**
 * Compute one `DayMetrics` per UTC day present in the inputs.
 *
 * `submissions` should cover the whole loaded range (not just one day) so a
 * session that submits is never mis-counted as abandoned on an earlier day.
 * Submissions are tallied into the day they were created.
 */
export const aggregateEvents = (
  events: EventRow[],
  submissions: SubmissionRef[]
): DayMetrics[] => {
  // Sessions that converted, anywhere in range — keyed by sessionId.
  const convertedSessions = new Set<string>();
  const submissionMsBySession = new Map<string, number>();
  for (const s of submissions) {
    if (!s.sessionId) continue;
    convertedSessions.add(s.sessionId);
    // Earliest submission wins for time-to-complete.
    const t = ms(s.createdAt);
    const prev = submissionMsBySession.get(s.sessionId);
    if (prev === undefined || t < prev) submissionMsBySession.set(s.sessionId, t);
  }

  // submits per day (independent of events — the submissions table is the
  // source of truth for the numerator, decision §7.7).
  const submitsByDay = new Map<string, number>();
  for (const s of submissions) {
    const day = dayKey(s.createdAt);
    submitsByDay.set(day, (submitsByDay.get(day) ?? 0) + 1);
  }

  // Per (day, session) rollup of event signals.
  const byDay = new Map<string, Map<string, SessionAgg>>();
  const ensure = (day: string, sid: string): SessionAgg => {
    let sessions = byDay.get(day);
    if (!sessions) byDay.set(day, (sessions = new Map()));
    let agg = sessions.get(sid);
    if (!agg) {
      sessions.set(
        sid,
        (agg = {
          view: false,
          start: false,
          attempt: false,
          firstStartMs: null,
          touchedFields: new Set(),
          lastTouchField: null,
          lastTouchMs: -1,
        })
      );
    }
    return agg;
  };

  for (const e of events) {
    const day = dayKey(e.created_at);
    const agg = ensure(day, e.session_id);
    const t = ms(e.created_at);
    switch (e.type) {
      case 'view':
        agg.view = true;
        break;
      case 'start':
        agg.start = true;
        if (agg.firstStartMs === null || t < agg.firstStartMs) agg.firstStartMs = t;
        break;
      case 'submit_attempt':
        agg.attempt = true;
        break;
      case 'field_change':
        if (e.field_id) {
          agg.touchedFields.add(e.field_id);
          if (t >= agg.lastTouchMs) {
            agg.lastTouchMs = t;
            agg.lastTouchField = e.field_id;
          }
        }
        break;
      // field_error is stored but not surfaced until v1.1.
    }
  }

  const allDays = new Set<string>([...byDay.keys(), ...submitsByDay.keys()]);
  const result: DayMetrics[] = [];

  for (const day of [...allDays].sort()) {
    const sessions = byDay.get(day) ?? new Map<string, SessionAgg>();
    let views = 0;
    let starts = 0;
    let attempts = 0;

    const reached = new Map<string, number>();
    const dropoff = new Map<string, number>();
    let timeSum = 0;
    let timeCount = 0;

    for (const [sid, agg] of sessions) {
      if (agg.view) views += 1;
      if (agg.start) starts += 1;
      if (agg.attempt) attempts += 1;

      for (const f of agg.touchedFields) reached.set(f, (reached.get(f) ?? 0) + 1);

      const converted = convertedSessions.has(sid);
      if (converted && agg.firstStartMs !== null) {
        const subMs = submissionMsBySession.get(sid)!;
        const delta = (subMs - agg.firstStartMs) / 1000;
        if (delta >= 0) {
          timeSum += delta;
          timeCount += 1;
        }
      }
      // Abandon attribution: a session active this day that never converted,
      // attributed to the last field it touched.
      if (!converted && (agg.view || agg.start) && agg.lastTouchField) {
        dropoff.set(agg.lastTouchField, (dropoff.get(agg.lastTouchField) ?? 0) + 1);
      }
    }

    const fields = new Set<string>([...reached.keys(), ...dropoff.keys()]);
    const dropoffByField: FieldDropoff[] = [...fields].map((fieldId) => ({
      fieldId,
      reached: reached.get(fieldId) ?? 0,
      dropoff: dropoff.get(fieldId) ?? 0,
    }));

    result.push({
      day,
      views,
      starts,
      attempts,
      submits: submitsByDay.get(day) ?? 0,
      avgSeconds: timeCount > 0 ? timeSum / timeCount : null,
      dropoffByField,
    });
  }

  return result;
};

/**
 * Fold a set of per-day metrics (from sealed rollups and/or live aggregation)
 * into the report shape the admin endpoint returns. `fieldLabels` maps field
 * ids to human labels for the drop-off table.
 */
export const toReport = (
  days: DayMetrics[],
  range: { from: string; to: string },
  fieldLabels: Record<string, string> = {}
): AnalyticsReport => {
  const sorted = [...days].sort((a, b) => a.day.localeCompare(b.day));

  let views = 0;
  let starts = 0;
  let attempts = 0;
  let submits = 0;
  let timeWeighted = 0;
  let timeWeight = 0;
  const reached = new Map<string, number>();
  const dropoff = new Map<string, number>();

  for (const d of sorted) {
    views += d.views;
    starts += d.starts;
    attempts += d.attempts;
    submits += d.submits;
    if (d.avgSeconds !== null && d.submits > 0) {
      timeWeighted += d.avgSeconds * d.submits;
      timeWeight += d.submits;
    }
    for (const f of d.dropoffByField) {
      reached.set(f.fieldId, (reached.get(f.fieldId) ?? 0) + f.reached);
      dropoff.set(f.fieldId, (dropoff.get(f.fieldId) ?? 0) + f.dropoff);
    }
  }

  const fields = new Set<string>([...reached.keys(), ...dropoff.keys()]);
  const dropoffByField = [...fields]
    .map((fieldId) => ({
      fieldId,
      label: fieldLabels[fieldId],
      reached: reached.get(fieldId) ?? 0,
      dropoff: dropoff.get(fieldId) ?? 0,
    }))
    .sort((a, b) => b.dropoff - a.dropoff);

  return {
    range,
    totals: {
      views,
      starts,
      attempts,
      submits,
      completionRate: views > 0 ? submits / views : 0,
      avgSeconds: timeWeight > 0 ? timeWeighted / timeWeight : null,
    },
    series: sorted.map((d) => ({ day: d.day, views: d.views, submits: d.submits })),
    dropoffByField,
  };
};

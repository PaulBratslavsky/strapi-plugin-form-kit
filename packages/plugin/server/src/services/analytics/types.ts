/**
 * Shared analytics shapes. The event taxonomy mirrors what the embed fires
 * (see resources/07-analytics.md §3). `submit_success` is intentionally NOT an
 * embed event — it's derived by joining sessions to the submissions table.
 */

export const EVENT_TYPES = [
  'view',
  'start',
  'field_change',
  'field_error',
  'submit_attempt',
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

/** A single event as it arrives from the embed (before server enrichment). */
export type IncomingEvent = {
  type: EventType;
  fieldId?: string;
  errorKind?: string;
  /** Client epoch-ms timestamp; server uses its own clock for storage. */
  t?: number;
};

/** A batch POSTed to /api/forms/:slug/events. */
export type EventBatch = {
  sessionId: string;
  events: IncomingEvent[];
  viewport?: string;
  /** Admin preview sets this so the form author isn't counted. */
  preview?: boolean;
};

/** A raw event row as stored / read back from `strapi_forms_events`. */
export type EventRow = {
  form_document_id: string;
  session_id: string;
  type: EventType;
  field_id: string | null;
  error_kind: string | null;
  created_at: string | Date;
};

/** A submission projected down to just what aggregation needs. */
export type SubmissionRef = {
  sessionId: string | null;
  createdAt: string | Date;
};

export type FieldDropoff = {
  fieldId: string;
  /** Distinct sessions that touched this field. */
  reached: number;
  /** Distinct abandoned sessions whose last touched field was this one. */
  dropoff: number;
};

/** The metrics for a single day — matches one `strapi_forms_event_rollups` row. */
export type DayMetrics = {
  day: string; // YYYY-MM-DD (UTC)
  views: number;
  starts: number;
  attempts: number;
  submits: number;
  avgSeconds: number | null;
  dropoffByField: FieldDropoff[];
};

/** The full payload the admin analytics endpoint returns. */
export type AnalyticsReport = {
  range: { from: string; to: string };
  totals: {
    views: number;
    starts: number;
    attempts: number;
    submits: number;
    completionRate: number; // submits / views, 0 when no views
    avgSeconds: number | null;
  };
  series: { day: string; views: number; submits: number }[];
  dropoffByField: (FieldDropoff & { label?: string })[];
};

/**
 * Validation + enrichment for incoming analytics events. Kept separate from the
 * controller so the shape rules are unit-testable without an HTTP context.
 */
import { createHash } from 'node:crypto';
import { EVENT_TYPES, type EventBatch, type EventType, type IncomingEvent } from './types';

const EVENT_TYPE_SET = new Set<string>(EVENT_TYPES);

/** Per-session hard cap (§4) — drop further events once a session is this chatty. */
export const MAX_EVENTS_PER_SESSION = 100;

const isType = (v: unknown): v is EventType => typeof v === 'string' && EVENT_TYPE_SET.has(v);

const cleanStr = (v: unknown, max: number): string | undefined =>
  typeof v === 'string' && v.length > 0 ? v.slice(0, max) : undefined;

/**
 * Parse + validate a raw request body into an EventBatch. Returns null when the
 * body is unusable (no session id or no recognisable events) — the caller drops
 * it silently; analytics is best-effort.
 */
export const parseBatch = (body: unknown): EventBatch | null => {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;

  const sessionId = cleanStr(b.sessionId, 64);
  if (!sessionId) return null;

  const rawEvents = Array.isArray(b.events) ? b.events : [];
  const events: IncomingEvent[] = [];
  for (const raw of rawEvents) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    if (!isType(r.type)) continue;
    events.push({
      type: r.type,
      fieldId: cleanStr(r.fieldId, 128),
      errorKind: cleanStr(r.errorKind, 64),
      t: typeof r.t === 'number' && Number.isFinite(r.t) ? r.t : undefined,
    });
    if (events.length >= MAX_EVENTS_PER_SESSION) break;
  }
  if (events.length === 0) return null;

  return {
    sessionId,
    events,
    viewport: cleanStr(b.viewport, 32),
    preview: b.preview === true,
  };
};

/**
 * Hash an IP for unique-visitor counting. Salted with a per-process secret + the
 * UTC day so the hash can't be reversed and doesn't survive across days (no
 * cross-day re-identification). Returns null when full anonymisation is on.
 */
export const hashIp = (
  ip: string,
  opts: { salt: string; anonymizeFully: boolean; day?: string }
): string | null => {
  if (opts.anonymizeFully) return null;
  const day = opts.day ?? new Date().toISOString().slice(0, 10);
  return createHash('sha256').update(`${opts.salt}:${day}:${ip}`).digest('hex').slice(0, 32);
};

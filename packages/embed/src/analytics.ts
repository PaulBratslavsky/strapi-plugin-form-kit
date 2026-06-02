/**
 * Cookieless, best-effort analytics reporter for the embed runtime.
 *
 * - sessionId is a sessionStorage UUID (cleared on tab close) — no cookie.
 * - events are batched and shipped with navigator.sendBeacon (fetch keepalive
 *   fallback); failures are dropped silently.
 * - Do-Not-Track and Global Privacy Control are honoured: when either is set,
 *   the reporter is inert (no session minted, no events sent).
 *
 * The reporter never throws — analytics must not break the host page.
 */
import type { AnalyticsEventType } from './types';

const SESSION_KEY = 'sf_sid';
const FLUSH_DELAY_MS = 1000;
/** Fire a final field_change for the field in focus after this idle gap. */
const FIELD_IDLE_MS = 5000;
const MAX_EVENTS_PER_SESSION = 100;

type QueuedEvent = { type: AnalyticsEventType; fieldId?: string; errorKind?: string; t: number };

export type Reporter = {
  sessionId: string | null;
  event: (type: AnalyticsEventType, detail?: { fieldId?: string; errorKind?: string }) => void;
  /** Note activity in a field; schedules an idle field_change flush. */
  touch: (fieldId: string) => void;
  flush: () => void;
  destroy: () => void;
};

const privacyOptOut = (): boolean => {
  if (typeof navigator === 'undefined') return true;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean; msDoNotTrack?: string };
  const dnt =
    nav.doNotTrack ?? (window as any).doNotTrack ?? nav.msDoNotTrack;
  if (dnt === '1' || dnt === 'yes') return true;
  if (nav.globalPrivacyControl === true) return true;
  return false;
};

const mintSessionId = (): string => {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    // sessionStorage can throw (privacy mode); fall back to an ephemeral id.
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }
};

/** A no-op reporter used when analytics is disabled (preview / opt-out). */
const inertReporter = (): Reporter => ({
  sessionId: null,
  event: () => {},
  touch: () => {},
  flush: () => {},
  destroy: () => {},
});

export const createReporter = (opts: {
  baseUrl: string;
  slug: string;
  disabled?: boolean;
  preview?: boolean;
}): Reporter => {
  if (opts.disabled || opts.preview || privacyOptOut()) return inertReporter();

  const sessionId = mintSessionId();
  const url = new URL(`/api/forms/${encodeURIComponent(opts.slug)}/events`, opts.baseUrl).toString();
  const viewport =
    typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : undefined;

  let queue: QueuedEvent[] = [];
  let total = 0; // events ever enqueued this session — drives the hard cap
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  let idleField: string | null = null;

  const send = (events: QueuedEvent[]) => {
    if (events.length === 0) return;
    const body = JSON.stringify({ sessionId, events, viewport });
    try {
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
        return;
      }
      void fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {});
    } catch {
      // Best-effort: drop.
    }
  };

  const flush = () => {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    if (queue.length === 0) return;
    const batch = queue;
    queue = [];
    send(batch);
  };

  const scheduleFlush = () => {
    if (flushTimer) return;
    flushTimer = setTimeout(flush, FLUSH_DELAY_MS);
    flushTimer.unref?.();
  };

  const event: Reporter['event'] = (type, detail) => {
    if (total >= MAX_EVENTS_PER_SESSION) return;
    total += 1;
    queue.push({ type, fieldId: detail?.fieldId, errorKind: detail?.errorKind, t: Date.now() });
    // submit_attempt is the conversion-critical signal — ship immediately.
    if (type === 'submit_attempt') flush();
    else scheduleFlush();
  };

  const touch: Reporter['touch'] = (fieldId) => {
    idleField = fieldId;
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (idleField) event('field_change', { fieldId: idleField });
    }, FIELD_IDLE_MS);
    idleTimer.unref?.();
  };

  const onPageHide = () => flush();
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('beforeunload', onPageHide);
  }

  return {
    sessionId,
    event,
    touch,
    flush,
    destroy: () => {
      flush();
      if (idleTimer) clearTimeout(idleTimer);
      if (typeof window !== 'undefined') {
        window.removeEventListener('pagehide', onPageHide);
        window.removeEventListener('beforeunload', onPageHide);
      }
    },
  };
};

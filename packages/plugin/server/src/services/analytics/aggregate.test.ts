import { describe, it, expect } from 'vitest';
import { aggregateEvents, dayKey, toReport } from './aggregate';
import type { EventRow, EventType, SubmissionRef } from './types';

const FORM = 'form-doc-1';
const DAY = '2026-05-20';
const at = (sec: number) => `${DAY}T10:00:${String(sec).padStart(2, '0')}.000Z`;

const ev = (
  session: string,
  type: EventType,
  sec: number,
  fieldId?: string
): EventRow => ({
  form_document_id: FORM,
  session_id: session,
  type,
  field_id: fieldId ?? null,
  error_kind: null,
  created_at: at(sec),
});

describe('dayKey', () => {
  it('returns the UTC calendar day', () => {
    expect(dayKey('2026-05-20T23:59:59.000Z')).toBe('2026-05-20');
    expect(dayKey(new Date('2026-05-20T00:00:00.000Z'))).toBe('2026-05-20');
  });
});

describe('aggregateEvents', () => {
  it('computes the funnel, time-to-complete, and per-field drop-off', () => {
    const events: EventRow[] = [
      // Session A — converts after touching f1 then f2.
      ev('A', 'view', 0),
      ev('A', 'start', 1),
      ev('A', 'field_change', 2, 'f1'),
      ev('A', 'field_change', 5, 'f2'),
      ev('A', 'submit_attempt', 6),
      // Session B — abandons at f1.
      ev('B', 'view', 0),
      ev('B', 'start', 1),
      ev('B', 'field_change', 3, 'f1'),
      // Session C — only viewed, never started.
      ev('C', 'view', 0),
    ];
    // A submitted 30s after its start (start at sec 1 → submit at sec 31).
    const submissions: SubmissionRef[] = [{ sessionId: 'A', createdAt: at(31) }];

    const days = aggregateEvents(events, submissions);
    expect(days).toHaveLength(1);
    const d = days[0]!;

    expect(d.day).toBe(DAY);
    expect(d.views).toBe(3);
    expect(d.starts).toBe(2);
    expect(d.attempts).toBe(1);
    expect(d.submits).toBe(1);
    expect(d.avgSeconds).toBeCloseTo(30, 1);

    const f1 = d.dropoffByField.find((f) => f.fieldId === 'f1')!;
    const f2 = d.dropoffByField.find((f) => f.fieldId === 'f2')!;
    // Both A and B touched f1; only A touched f2.
    expect(f1.reached).toBe(2);
    expect(f2.reached).toBe(1);
    // B abandoned with f1 as its last touch; A converted so contributes none.
    expect(f1.dropoff).toBe(1);
    expect(f2.dropoff).toBe(0);
  });

  it('counts submissions into their own day even with no events', () => {
    const days = aggregateEvents([], [{ sessionId: null, createdAt: at(5) }]);
    expect(days).toHaveLength(1);
    expect(days[0]!.submits).toBe(1);
    expect(days[0]!.views).toBe(0);
    expect(days[0]!.avgSeconds).toBeNull();
  });

  it('does not attribute drop-off to converted sessions', () => {
    const events: EventRow[] = [
      ev('A', 'start', 1),
      ev('A', 'field_change', 2, 'f1'),
    ];
    const days = aggregateEvents(events, [{ sessionId: 'A', createdAt: at(10) }]);
    const f1 = days[0]!.dropoffByField.find((f) => f.fieldId === 'f1')!;
    expect(f1.reached).toBe(1);
    expect(f1.dropoff).toBe(0);
  });
});

describe('toReport', () => {
  it('folds days into totals, series, and a sorted drop-off table', () => {
    const days = aggregateEvents(
      [
        ev('A', 'view', 0),
        ev('A', 'start', 1),
        ev('A', 'field_change', 2, 'email'),
        ev('B', 'view', 0),
      ],
      []
    );
    const report = toReport(days, { from: DAY, to: DAY }, { email: 'Email address' });

    expect(report.totals.views).toBe(2);
    expect(report.totals.submits).toBe(0);
    expect(report.totals.completionRate).toBe(0);
    expect(report.series).toEqual([{ day: DAY, views: 2, submits: 0 }]);

    const email = report.dropoffByField.find((f) => f.fieldId === 'email')!;
    expect(email.label).toBe('Email address');
    expect(email.dropoff).toBe(1); // A started, touched email, never converted
  });

  it('computes completion rate as submits / views', () => {
    const report = toReport(
      [{ day: DAY, views: 10, starts: 8, attempts: 6, submits: 4, avgSeconds: 12, dropoffByField: [] }],
      { from: DAY, to: DAY }
    );
    expect(report.totals.completionRate).toBeCloseTo(0.4, 5);
    expect(report.totals.avgSeconds).toBe(12);
  });
});

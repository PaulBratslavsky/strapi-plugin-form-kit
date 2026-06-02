import { describe, it, expect } from 'vitest';
import { parseBatch, hashIp, MAX_EVENTS_PER_SESSION } from './ingest';

describe('parseBatch', () => {
  it('parses a well-formed batch and drops unknown event types', () => {
    const batch = parseBatch({
      sessionId: 'sess-1',
      viewport: '1280x800',
      events: [
        { type: 'view' },
        { type: 'field_change', fieldId: 'email' },
        { type: 'not-a-real-event' },
        { type: 'submit_attempt' },
      ],
    });
    expect(batch).not.toBeNull();
    expect(batch!.sessionId).toBe('sess-1');
    expect(batch!.viewport).toBe('1280x800');
    expect(batch!.events.map((e) => e.type)).toEqual(['view', 'field_change', 'submit_attempt']);
    expect(batch!.events[1]!.fieldId).toBe('email');
  });

  it('returns null when sessionId is missing', () => {
    expect(parseBatch({ events: [{ type: 'view' }] })).toBeNull();
  });

  it('returns null when there are no recognisable events', () => {
    expect(parseBatch({ sessionId: 's', events: [{ type: 'bogus' }] })).toBeNull();
    expect(parseBatch({ sessionId: 's', events: [] })).toBeNull();
  });

  it('returns null for non-object bodies', () => {
    expect(parseBatch(null)).toBeNull();
    expect(parseBatch('nope')).toBeNull();
  });

  it('caps events per batch at the hard limit', () => {
    const events = Array.from({ length: MAX_EVENTS_PER_SESSION + 50 }, () => ({ type: 'view' }));
    const batch = parseBatch({ sessionId: 's', events });
    expect(batch!.events).toHaveLength(MAX_EVENTS_PER_SESSION);
  });

  it('flags preview batches', () => {
    const batch = parseBatch({ sessionId: 's', preview: true, events: [{ type: 'view' }] });
    expect(batch!.preview).toBe(true);
  });
});

describe('hashIp', () => {
  it('is stable for the same (ip, day, salt) and differs across days', () => {
    const a = hashIp('1.2.3.4', { salt: 'k', anonymizeFully: false, day: '2026-05-20' });
    const b = hashIp('1.2.3.4', { salt: 'k', anonymizeFully: false, day: '2026-05-20' });
    const c = hashIp('1.2.3.4', { salt: 'k', anonymizeFully: false, day: '2026-05-21' });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[0-9a-f]{32}$/);
  });

  it('returns null when full anonymisation is on', () => {
    expect(hashIp('1.2.3.4', { salt: 'k', anonymizeFully: true })).toBeNull();
  });

  it('does not leak the raw IP into the hash output', () => {
    const h = hashIp('203.0.113.7', { salt: 'k', anonymizeFully: false, day: '2026-05-20' });
    expect(h).not.toContain('203.0.113.7');
  });
});

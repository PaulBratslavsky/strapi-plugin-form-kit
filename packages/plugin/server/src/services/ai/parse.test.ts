/**
 * parse.ts is the end-to-end harness — raw model output to canonical schema.
 * Covers fence-stripping, outermost-brace carving, loose validation, and
 * the connection to the normaliser.
 */
import { describe, it, expect } from 'vitest';
import { tryParseSchema, tryParseStyle } from './parse';

describe('tryParseSchema', () => {
  it('parses a clean JSON object', () => {
    const raw = JSON.stringify({
      fields: [{ type: 'text', name: 'name', label: 'Name' }],
    });
    const r = tryParseSchema(raw);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.schema.fields).toHaveLength(1);
      expect(r.schema.fields[0].label).toBe('Name');
    }
  });

  it('strips markdown fences', () => {
    const raw = '```json\n{"fields":[{"type":"text","label":"X"}]}\n```';
    const r = tryParseSchema(raw);
    expect(r.ok).toBe(true);
  });

  it('strips bare ``` fences without a language hint', () => {
    const raw = '```\n{"fields":[{"type":"text","label":"X"}]}\n```';
    const r = tryParseSchema(raw);
    expect(r.ok).toBe(true);
  });

  it('carves outermost {...} when the model includes preamble', () => {
    const raw = `Here's the form schema you asked for:

{"fields":[{"type":"email","label":"Email"}]}

Let me know if you want any changes!`;
    const r = tryParseSchema(raw);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.schema.fields[0].type).toBe('email');
  });

  it('returns a typed parse error when JSON is malformed', () => {
    const raw = '{"fields":[{"type":"text",}]}'; // trailing comma
    const r = tryParseSchema(raw);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/JSON parse error/i);
  });

  it('returns the canonical FormSchema shape with normalised fields', () => {
    const raw = JSON.stringify({
      fields: [{ type: 'tel', name: 'phone' }], // type alias, no label
    });
    const r = tryParseSchema(raw);
    expect(r.ok).toBe(true);
    if (r.ok) {
      // Type alias resolved, label derived from name, UUID assigned.
      expect(r.schema.fields[0].type).toBe('phone');
      expect(r.schema.fields[0].label).toBe('Phone');
      expect(r.schema.fields[0].id).toMatch(/^[0-9a-f-]{36}$/i);
    }
  });

  it('accepts an empty fields array (drafts may be empty)', () => {
    const raw = JSON.stringify({ fields: [] });
    const r = tryParseSchema(raw);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.schema.fields).toEqual([]);
  });

  it('handles whitespace/newlines around the JSON', () => {
    const raw = '\n\n  \t{"fields":[{"type":"text","label":"OK"}]}  \n  ';
    const r = tryParseSchema(raw);
    expect(r.ok).toBe(true);
  });
});

describe('tryParseStyle', () => {
  it('returns an empty diff for {}', () => {
    const r = tryParseStyle('{}');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.theme).toEqual({});
  });

  it('maps the preset key through to the theme', () => {
    const r = tryParseStyle(JSON.stringify({ preset: 'friendly' }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.theme).toEqual({ preset: 'friendly' });
  });

  it('resolves named colors to hex', () => {
    const r = tryParseStyle(JSON.stringify({ primaryColor: 'indigo' }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.theme.primaryColor).toBe('#4945ff');
  });

  it('accepts hex colors and canonicalises to lowercase', () => {
    const r = tryParseStyle(JSON.stringify({ primaryColor: '#AABBCC' }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.theme.primaryColor).toBe('#aabbcc');
  });

  it('silently drops unknown color names rather than failing the whole response', () => {
    const r = tryParseStyle(JSON.stringify({ primaryColor: 'not-a-real-color', preset: 'clean' }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.theme.primaryColor).toBeUndefined();
      expect(r.theme.preset).toBe('clean');
    }
  });

  it('passes through enum values for layout tokens', () => {
    const r = tryParseStyle(
      JSON.stringify({ borderRadius: 'pill', fontFamily: 'serif', shadow: true })
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.theme.borderRadius).toBe('pill');
      expect(r.theme.fontFamily).toBe('serif');
      expect(r.theme.shadow).toBe(true);
    }
  });

  it('strips fences for style responses too', () => {
    const r = tryParseStyle('```json\n{"preset":"bold"}\n```');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.theme.preset).toBe('bold');
  });

  it('rejects fundamentally non-JSON garbage', () => {
    const r = tryParseStyle('the model went on a creative writing spree');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/JSON parse error/i);
  });
});

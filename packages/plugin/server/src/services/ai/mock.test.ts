/**
 * MockProvider is the test/dev-mode stand-in for a real LLM. These tests
 * cover the keyword-matching heuristic plus the streaming-simulation
 * behaviour (yields chunks via setTimeout — exercised here without real
 * delays via vitest's fake timers).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MockProvider } from './mock';

const noFieldTypes: Array<{ name: string; aiHint: string }> = [];

describe('MockProvider — generateForm', () => {
  let provider: MockProvider;
  beforeEach(() => {
    provider = new MockProvider();
  });

  it('always emits a Name + Email field as the sane fallback', async () => {
    const schema = await provider.generateForm({
      prompt: 'random unrelated prompt with no recognised keywords',
      availableFieldTypes: noFieldTypes,
    });
    const labels = schema.fields.map((f) => f.label);
    expect(labels).toContain('Name');
    expect(labels.some((l) => /email/i.test(l))).toBe(true);
  });

  it('honors keyword matches — "message" produces a textarea', async () => {
    const schema = await provider.generateForm({
      prompt: 'a contact form with a message field',
      availableFieldTypes: noFieldTypes,
    });
    expect(schema.fields.some((f) => f.type === 'textarea')).toBe(true);
  });

  it('honors keyword matches — "phone" produces a phone field', async () => {
    const schema = await provider.generateForm({
      prompt: 'lead form: name, phone, company',
      availableFieldTypes: noFieldTypes,
    });
    expect(schema.fields.some((f) => f.type === 'phone')).toBe(true);
  });

  it('tones the submit button label for booking-like prompts', async () => {
    const schema = await provider.generateForm({
      prompt: 'book a demo for our SaaS',
      availableFieldTypes: noFieldTypes,
    });
    expect(schema.settings.submitButtonLabel).toBe('Book');
  });

  it('uses "Send" as the default submit label otherwise', async () => {
    const schema = await provider.generateForm({
      prompt: 'contact us please',
      availableFieldTypes: noFieldTypes,
    });
    expect(schema.settings.submitButtonLabel).toBe('Send');
  });

  it('emits a valid canonical FormSchema (all required fields present)', async () => {
    const schema = await provider.generateForm({
      prompt: 'simple contact form',
      availableFieldTypes: noFieldTypes,
    });
    expect(schema.schemaVersion).toBe(1);
    expect(Array.isArray(schema.fields)).toBe(true);
    expect(schema.fields.length).toBeGreaterThan(0);
    for (const field of schema.fields) {
      expect(field.id).toMatch(/^[0-9a-f-]{36}$/i);
      expect(field.label).toBeTruthy();
    }
  });
});

describe('MockProvider — refineForm', () => {
  let provider: MockProvider;
  beforeEach(() => {
    provider = new MockProvider();
  });

  it('handles "add a phone field" by appending one', async () => {
    const current = {
      schemaVersion: 1 as const,
      fields: [{ id: 'x', type: 'text', label: 'Name', validations: [] }],
      settings: {},
    };
    const refined = await provider.refineForm({
      instruction: 'add a phone field',
      currentSchema: current as any,
    });
    expect(refined.fields).toHaveLength(2);
    expect(refined.fields.some((f) => f.type === 'phone')).toBe(true);
  });

  it('no-ops on unrecognised instructions (returns current schema)', async () => {
    const current = {
      schemaVersion: 1 as const,
      fields: [{ id: 'x', type: 'text', label: 'Name', validations: [] }],
      settings: {},
    };
    const refined = await provider.refineForm({
      instruction: 'do something obscure the mock has no rule for',
      currentSchema: current as any,
    });
    expect(refined.fields).toHaveLength(1);
    expect(refined.fields[0].label).toBe('Name');
  });
});

describe('MockProvider — streamForm', () => {
  let provider: MockProvider;
  beforeEach(() => {
    provider = new MockProvider();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('emits chunks via onChunk and resolves with the final schema', async () => {
    const chunks: string[] = [];
    const promise = provider.streamForm({
      mode: 'generate',
      prompt: 'contact form with name email message',
      availableFieldTypes: noFieldTypes,
      onChunk: (text) => chunks.push(text),
    });
    // Advance virtual time through all the setTimeout delays.
    await vi.runAllTimersAsync();
    const schema = await promise;

    expect(chunks.length).toBeGreaterThan(0);
    // Concatenated chunks should round-trip to valid JSON of the schema.
    const reassembled = JSON.parse(chunks.join(''));
    expect(reassembled.schemaVersion).toBe(1);
    expect(reassembled.fields).toEqual(schema.fields);
  });
});

describe('MockProvider — streamStyle', () => {
  let provider: MockProvider;
  beforeEach(() => {
    provider = new MockProvider();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('maps "dark theme" prompt to a dark theme override', async () => {
    const chunks: string[] = [];
    const promise = provider.streamStyle({
      prompt: 'make it dark',
      onChunk: (text) => chunks.push(text),
    });
    await vi.runAllTimersAsync();
    const theme = await promise;
    expect(theme.preset).toBe('bold');
    expect(theme.backgroundColor).toBe('#0a0a14');
    expect(theme.textColor).toBe('#ffffff');
  });

  it('maps "friendly" to the friendly preset with rounded radius', async () => {
    const promise = provider.streamStyle({
      prompt: 'make it more friendly',
      onChunk: () => {},
    });
    await vi.runAllTimersAsync();
    const theme = await promise;
    expect(theme.preset).toBe('friendly');
    expect(theme.borderRadius).toBe('lg');
  });

  it('falls back to clean preset when no keyword matches', async () => {
    const promise = provider.streamStyle({
      prompt: 'just a regular form',
      onChunk: () => {},
    });
    await vi.runAllTimersAsync();
    const theme = await promise;
    expect(theme.preset).toBe('clean');
  });
});

describe('MockProvider — healthCheck', () => {
  it('always reports ok (mock never fails)', async () => {
    const provider = new MockProvider();
    const r = await provider.healthCheck();
    expect(r.ok).toBe(true);
  });
});

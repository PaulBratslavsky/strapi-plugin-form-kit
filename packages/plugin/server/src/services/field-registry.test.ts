import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import factory from './field-registry';

describe('fieldRegistry', () => {
  let svc: ReturnType<typeof factory>;

  beforeEach(() => {
    svc = factory();
    svc._reset();
  });

  it('registers and retrieves a field type', () => {
    svc.register({
      name: 'text',
      plugin: 'core',
      storageType: 'string',
      valueSchema: z.string(),
      configSchema: z.object({ label: z.string() }),
      aiHint: 'A single-line text input',
    });
    expect(svc.get('text')?.name).toBe('text');
    expect(svc.list().length).toBe(1);
  });

  it('throws on duplicate registration', () => {
    const reg = {
      name: 'dup',
      plugin: 'core',
      storageType: 'string' as const,
      valueSchema: z.string(),
      configSchema: z.object({}),
      aiHint: '',
    };
    svc.register(reg);
    expect(() => svc.register(reg)).toThrow(/already registered/);
  });

  it('validateValue returns ok for valid values, errors for invalid', () => {
    svc.register({
      name: 'email',
      plugin: 'core',
      storageType: 'string',
      valueSchema: z.string().email(),
      configSchema: z.object({}),
      aiHint: '',
    });
    expect(svc.validateValue('email', 'a@b.co').ok).toBe(true);
    const bad = svc.validateValue('email', 'not-an-email');
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors.length).toBeGreaterThan(0);
  });

  it('validateValue rejects unknown type names', () => {
    const r = svc.validateValue('nope', 'x');
    expect(r.ok).toBe(false);
  });
});

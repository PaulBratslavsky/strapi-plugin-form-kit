import { describe, it, expect, beforeEach } from 'vitest';
import { v4 as uuid } from 'uuid';
import fieldRegistryFactory from './field-registry';
import validatorFactory from './form-schema-validator';
import { registerCoreFieldTypes } from '../core-field-types';

describe('formSchemaValidator', () => {
  const registry = fieldRegistryFactory();
  beforeEach(() => {
    registry._reset();
    registerCoreFieldTypes(registry);
  });

  // Inject a fake `strapi` so the validator can find the registry.
  const fakeStrapi: any = {
    plugin: () => ({ service: () => registry }),
  };
  const validator = validatorFactory({ strapi: fakeStrapi });

  it('accepts a minimal valid schema', () => {
    const id = uuid();
    const r = validator.validateSchema({
      schemaVersion: 1,
      fields: [{ id, type: 'text', label: 'Name' }],
      settings: {},
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.schema.fields[0]!.id).toBe(id);
      // settings defaults applied
      expect(r.schema.settings.honeypotEnabled).toBe(true);
    }
  });

  it('rejects unknown field types with a helpful error', () => {
    const r = validator.validateSchema({
      schemaVersion: 1,
      fields: [{ id: uuid(), type: 'nope', label: 'X' }],
      settings: {},
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]!.message).toMatch(/Unknown field type/);
    }
  });

  it('rejects duplicate field ids', () => {
    const id = uuid();
    const r = validator.validateSchema({
      schemaVersion: 1,
      fields: [
        { id, type: 'text', label: 'A' },
        { id, type: 'text', label: 'B' },
      ],
      settings: {},
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => /Duplicate field id/.test(e.message))).toBe(true);
    }
  });

  it('rejects schemaVersion != 1', () => {
    const r = validator.validateSchema({ schemaVersion: 2, fields: [], settings: {} });
    expect(r.ok).toBe(false);
  });

  it('validateSubmission accepts valid data and strips unknown keys', () => {
    const id = uuid();
    const schema = (validator.validateSchema as any)({
      schemaVersion: 1,
      fields: [{ id, type: 'email', label: 'Email', validations: [{ kind: 'required' }] }],
      settings: {},
    });
    expect(schema.ok).toBe(true);
    if (!schema.ok) return;
    const res = validator.validateSubmission({
      schema: schema.schema,
      data: { [id]: 'a@b.co', extra: 'ignored' },
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data).toEqual({ [id]: 'a@b.co' });
    }
  });

  it('validateSubmission flags missing required fields', () => {
    const id = uuid();
    const schema = validator.validateSchema({
      schemaVersion: 1,
      fields: [{ id, type: 'text', label: 'Name', validations: [{ kind: 'required' }] }],
      settings: {},
    });
    if (!schema.ok) throw new Error('schema invalid');
    const res = validator.validateSubmission({ schema: schema.schema, data: {} });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors[id]).toBeDefined();
    }
  });

  it('validateSubmission rejects malformed emails', () => {
    const id = uuid();
    const schema = validator.validateSchema({
      schemaVersion: 1,
      fields: [{ id, type: 'email', label: 'Email' }],
      settings: {},
    });
    if (!schema.ok) throw new Error('schema invalid');
    const res = validator.validateSubmission({ schema: schema.schema, data: { [id]: 'oops' } });
    expect(res.ok).toBe(false);
  });

  it('validateSubmission enforces dropdown options', () => {
    const id = uuid();
    const schema = validator.validateSchema({
      schemaVersion: 1,
      fields: [
        {
          id,
          type: 'dropdown',
          label: 'Color',
          options: [
            { label: 'Red', value: 'red' },
            { label: 'Blue', value: 'blue' },
          ],
        },
      ],
      settings: {},
    });
    if (!schema.ok) throw new Error('schema invalid');
    const ok = validator.validateSubmission({ schema: schema.schema, data: { [id]: 'red' } });
    expect(ok.ok).toBe(true);
    const bad = validator.validateSubmission({ schema: schema.schema, data: { [id]: 'green' } });
    expect(bad.ok).toBe(false);
  });
});

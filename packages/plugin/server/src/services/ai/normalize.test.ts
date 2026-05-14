/**
 * normalize.ts is what makes small local models viable. It takes a permissive
 * `LooseSchemaInput` and produces a canonical FormSchema. These tests cover
 * the messy real-world inputs gemma4 / llama3 actually emit.
 */
import { describe, it, expect } from 'vitest';
import { looseToFormSchema } from './normalize';

describe('looseToFormSchema', () => {
  it('returns a canonical schema with schemaVersion + settings even for empty input', () => {
    const out = looseToFormSchema({ fields: [] });
    expect(out).toEqual({ schemaVersion: 1, fields: [], settings: {} });
  });

  it('assigns a UUID to every field — even when the model emitted nothing', () => {
    const out = looseToFormSchema({ fields: [{ type: 'text' }, { type: 'email' }] });
    const ids = out.fields.map((f) => f.id);
    expect(ids).toHaveLength(2);
    for (const id of ids) {
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    }
    expect(ids[0]).not.toBe(ids[1]); // distinct
  });

  it('coerces common type aliases to canonical types', () => {
    const out = looseToFormSchema({
      fields: [
        { type: 'tel' },
        { type: 'select' },
        { type: 'paragraph' },
        { type: 'choices' },
        { type: 'longtext' },
        { type: 'YESNO' },
      ],
    });
    const types = out.fields.map((f) => f.type);
    expect(types).toEqual(['phone', 'dropdown', 'textarea', 'checkboxes', 'textarea', 'radio']);
  });

  it('falls back to "text" for entirely unknown types', () => {
    const out = looseToFormSchema({ fields: [{ type: 'spaceship' }] });
    expect(out.fields[0].type).toBe('text');
  });

  it('derives label from name when label is missing', () => {
    const out = looseToFormSchema({
      fields: [
        { type: 'text', name: 'first_name' },
        { type: 'email', name: 'emailAddress' },
        { type: 'text', name: 'shipping-address' },
      ],
    });
    expect(out.fields[0].label).toBe('First Name');
    expect(out.fields[1].label).toBe('Email Address');
    expect(out.fields[2].label).toBe('Shipping Address');
  });

  it('derives label from type + index when both name and label are missing', () => {
    const out = looseToFormSchema({ fields: [{ type: 'text' }, { type: 'email' }] });
    expect(out.fields[0].label).toBe('Text 1');
    expect(out.fields[1].label).toBe('Email 2');
  });

  it('builds the validations array from boolean / number flags', () => {
    const out = looseToFormSchema({
      fields: [
        { type: 'text', label: 'Name', required: true },
        { type: 'text', label: 'Bio', minLength: 10, maxLength: 280 },
        { type: 'text', label: 'Slug', pattern: '^[a-z-]+$' },
      ],
    });
    const validations0 = out.fields[0].validations as any[];
    expect(validations0).toEqual([
      { kind: 'required', message: 'Name is required.' },
    ]);
    const validations1 = out.fields[1].validations as any[];
    expect(validations1).toContainEqual({ kind: 'minLength', value: 10 });
    expect(validations1).toContainEqual({ kind: 'maxLength', value: 280 });
    const validations2 = out.fields[2].validations as any[];
    expect(validations2).toContainEqual({ kind: 'pattern', regex: '^[a-z-]+$' });
  });

  it('auto-adds an email validator on email fields', () => {
    const out = looseToFormSchema({ fields: [{ type: 'email', label: 'Email' }] });
    expect(out.fields[0].validations).toContainEqual({ kind: 'email' });
  });

  it('auto-adds a url validator on url fields', () => {
    const out = looseToFormSchema({ fields: [{ type: 'url', label: 'Website' }] });
    expect(out.fields[0].validations).toContainEqual({ kind: 'url' });
  });

  it('synthesises at least one option for choice fields with none', () => {
    const out = looseToFormSchema({
      fields: [{ type: 'dropdown', label: 'Color' }],
    });
    const field = out.fields[0] as any;
    expect(field.options).toHaveLength(1);
    expect(field.options[0]).toEqual({ value: 'option_1', label: 'Option 1' });
  });

  it('normalises choice options — fills missing value or label from each other', () => {
    const out = looseToFormSchema({
      fields: [
        {
          type: 'dropdown',
          label: 'Severity',
          options: [
            { value: 'high', label: 'High' },
            { label: 'Medium' }, // no value
            { value: 'low' }, // no label
          ],
        },
      ],
    });
    const opts = (out.fields[0] as any).options;
    expect(opts).toEqual([
      { value: 'high', label: 'High' },
      { value: 'medium', label: 'Medium' },
      { value: 'low', label: 'Low' },
    ]);
  });

  it('does not add options to non-choice fields', () => {
    const out = looseToFormSchema({ fields: [{ type: 'text', label: 'Name' }] });
    expect((out.fields[0] as any).options).toBeUndefined();
  });

  it('passes through placeholder and helpText when provided', () => {
    const out = looseToFormSchema({
      fields: [{ type: 'text', label: 'Bio', placeholder: 'About you', helpText: 'Markdown ok' }],
    });
    const f = out.fields[0] as any;
    expect(f.placeholder).toBe('About you');
    expect(f.helpText).toBe('Markdown ok');
  });

  it('slugifies name into a stable identifier', () => {
    const out = looseToFormSchema({
      fields: [{ type: 'text', name: 'Email Address!', label: 'Email' }],
    });
    expect((out.fields[0] as any).name).toBe('email_address');
  });

  it('survives a missing fields array (returns empty)', () => {
    expect(looseToFormSchema({} as any).fields).toEqual([]);
    expect(looseToFormSchema(undefined as any).fields).toEqual([]);
  });
});

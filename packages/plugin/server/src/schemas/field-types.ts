import { z } from 'zod';
import { ChoiceOption, ConditionalRule, ValidationRule } from './validation-rules';

/**
 * Properties shared by every field. Extended per-type in the discriminated union below.
 */
export const FieldBase = z.object({
  id: z.string().uuid(),
  label: z.string().min(1),
  helpText: z.string().optional(),
  placeholder: z.string().optional(),
  defaultValue: z.unknown().optional(),
  validations: z.array(ValidationRule).default([]),
  conditional: ConditionalRule.optional(),
});

/**
 * Discriminated union over the 12 core field types. Custom field types extend this
 * union at runtime via the FieldRegistry — see field-registry.ts and core-field-types.ts.
 */
export const CoreField = z.discriminatedUnion('type', [
  FieldBase.extend({ type: z.literal('text') }),
  FieldBase.extend({
    type: z.literal('textarea'),
    rows: z.number().int().min(2).max(20).default(4),
  }),
  FieldBase.extend({ type: z.literal('email') }),
  FieldBase.extend({ type: z.literal('number'), step: z.number().optional() }),
  FieldBase.extend({ type: z.literal('phone') }),
  FieldBase.extend({ type: z.literal('url') }),
  FieldBase.extend({
    type: z.literal('dropdown'),
    options: z.array(ChoiceOption).min(1),
  }),
  FieldBase.extend({
    type: z.literal('radio'),
    options: z.array(ChoiceOption).min(1),
  }),
  FieldBase.extend({
    type: z.literal('checkboxes'),
    options: z.array(ChoiceOption).min(1),
  }),
  FieldBase.extend({
    type: z.literal('date'),
    min: z.string().optional(),
    max: z.string().optional(),
  }),
  FieldBase.extend({ type: z.literal('hidden'), defaultValue: z.string() }),
  FieldBase.extend({ type: z.literal('content'), html: z.string() }),
]);

export type CoreField = z.infer<typeof CoreField>;
export type CoreFieldType = CoreField['type'];

export const CORE_FIELD_TYPES: CoreFieldType[] = [
  'text',
  'textarea',
  'email',
  'number',
  'phone',
  'url',
  'dropdown',
  'radio',
  'checkboxes',
  'date',
  'hidden',
  'content',
];

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
 * Dynamic options for choice fields (dropdown / radio / checkboxes). When
 * present on a field, the public schema endpoint resolves the referenced
 * collection at read time and projects each row to a `{ label, value }`
 * pair, substituting into `options` before the response is sent. Static
 * `options` still works — `optionsSource` is purely additive.
 */
export const OptionsSource = z.object({
  kind: z.literal('collection'),
  uid: z.string(),           // e.g. "api::product.product"
  labelField: z.string(),    // attribute name shown to the user
  valueField: z.string().default('documentId'), // attribute submitted
});
export type OptionsSource = z.infer<typeof OptionsSource>;

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
    // Drafts may have empty `options` (user is mid-edit or toggled
    // optionsSource off). Publish-time validation enforces at-least-one
    // option / a configured optionsSource separately.
    options: z.array(ChoiceOption).optional(),
    optionsSource: OptionsSource.optional(),
  }),
  FieldBase.extend({
    type: z.literal('radio'),
    options: z.array(ChoiceOption).optional(),
    optionsSource: OptionsSource.optional(),
  }),
  FieldBase.extend({
    type: z.literal('checkboxes'),
    options: z.array(ChoiceOption).optional(),
    optionsSource: OptionsSource.optional(),
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

import { z } from 'zod';
import type { FieldRegistryService } from './services/field-registry';
import { ChoiceOption, ConditionalRule, ValidationRule } from './schemas/validation-rules';

/**
 * The 12 core field types. These are registered into the FieldRegistry at plugin
 * bootstrap so the AI builder, the visual builder, and the submission validator
 * all see them through the same surface as custom types.
 *
 * Each registration carries a `valueSchema` (the on-the-wire shape of a submission
 * value for this field) and a `configSchema` (the full field-definition shape, including
 * type-specific knobs such as `options` for dropdowns).
 */

const baseField = z.object({
  id: z.string().uuid(),
  label: z.string().min(1),
  helpText: z.string().optional(),
  placeholder: z.string().optional(),
  defaultValue: z.unknown().optional(),
  validations: z.array(ValidationRule).default([]),
  conditional: ConditionalRule.optional(),
});

export const registerCoreFieldTypes = (registry: FieldRegistryService) => {
  const PLUGIN = 'strapi-plugin-forms';

  registry.register({
    name: 'text',
    plugin: PLUGIN,
    storageType: 'string',
    valueSchema: z.string(),
    configSchema: baseField.extend({ type: z.literal('text') }),
    aiHint: 'Single-line plain-text input. Use for names, short answers.',
  });

  registry.register({
    name: 'textarea',
    plugin: PLUGIN,
    storageType: 'string',
    valueSchema: z.string(),
    configSchema: baseField.extend({
      type: z.literal('textarea'),
      rows: z.number().int().min(2).max(20).default(4),
    }),
    aiHint: 'Multi-line plain-text input. Use for messages, comments, long descriptions.',
  });

  registry.register({
    name: 'email',
    plugin: PLUGIN,
    storageType: 'string',
    valueSchema: z.string().email(),
    configSchema: baseField.extend({ type: z.literal('email') }),
    aiHint: 'Email address input with built-in format validation.',
  });

  registry.register({
    name: 'number',
    plugin: PLUGIN,
    storageType: 'number',
    valueSchema: z.number(),
    configSchema: baseField.extend({ type: z.literal('number'), step: z.number().optional() }),
    aiHint: 'Numeric input. Use for ages, quantities, ratings.',
  });

  registry.register({
    name: 'phone',
    plugin: PLUGIN,
    storageType: 'string',
    valueSchema: z.string().min(1),
    configSchema: baseField.extend({ type: z.literal('phone') }),
    aiHint: 'Phone number input. Free-form string in v1 (no E.164 normalization).',
  });

  registry.register({
    name: 'url',
    plugin: PLUGIN,
    storageType: 'string',
    valueSchema: z.string().url(),
    configSchema: baseField.extend({ type: z.literal('url') }),
    aiHint: 'URL input with built-in http(s) format validation.',
  });

  registry.register({
    name: 'dropdown',
    plugin: PLUGIN,
    storageType: 'string',
    valueSchema: z.string(),
    configSchema: baseField.extend({
      type: z.literal('dropdown'),
      options: z.array(ChoiceOption).min(1),
    }),
    aiHint: 'Single-select from a list of options.',
  });

  registry.register({
    name: 'radio',
    plugin: PLUGIN,
    storageType: 'string',
    valueSchema: z.string(),
    configSchema: baseField.extend({
      type: z.literal('radio'),
      options: z.array(ChoiceOption).min(1),
    }),
    aiHint: 'Single-select shown as radio buttons. Use for short option lists.',
  });

  registry.register({
    name: 'checkboxes',
    plugin: PLUGIN,
    storageType: 'json',
    valueSchema: z.array(z.string()),
    configSchema: baseField.extend({
      type: z.literal('checkboxes'),
      options: z.array(ChoiceOption).min(1),
    }),
    aiHint: 'Multi-select from a list of options.',
  });

  registry.register({
    name: 'date',
    plugin: PLUGIN,
    storageType: 'string',
    valueSchema: z.string(),
    configSchema: baseField.extend({
      type: z.literal('date'),
      min: z.string().optional(),
      max: z.string().optional(),
    }),
    aiHint: 'Date picker. Stored as an ISO-8601 date string.',
  });

  registry.register({
    name: 'hidden',
    plugin: PLUGIN,
    storageType: 'string',
    valueSchema: z.string(),
    configSchema: baseField.extend({ type: z.literal('hidden'), defaultValue: z.string() }),
    aiHint: 'Hidden field with a fixed default value. Use for tracking parameters.',
  });

  registry.register({
    name: 'content',
    plugin: PLUGIN,
    storageType: 'string',
    valueSchema: z.unknown(),
    configSchema: baseField.extend({ type: z.literal('content'), html: z.string() }),
    aiHint: 'Section header or instructional text shown between fields. Not user-input.',
  });
};

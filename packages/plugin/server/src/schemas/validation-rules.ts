import { z } from 'zod';

/**
 * Built-in validation rules. Discriminated on `kind`. Custom field types' configSchema
 * may also use these or extend them via the field registry.
 */
export const ValidationRule = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('required'), message: z.string().optional() }),
  z.object({ kind: z.literal('minLength'), value: z.number().int().nonnegative(), message: z.string().optional() }),
  z.object({ kind: z.literal('maxLength'), value: z.number().int().positive(), message: z.string().optional() }),
  z.object({ kind: z.literal('min'), value: z.number(), message: z.string().optional() }),
  z.object({ kind: z.literal('max'), value: z.number(), message: z.string().optional() }),
  z.object({ kind: z.literal('pattern'), regex: z.string(), message: z.string().optional() }),
  z.object({ kind: z.literal('email'), message: z.string().optional() }),
  z.object({ kind: z.literal('url'), message: z.string().optional() }),
  // Cross-field equality — e.g. "confirm password" or "confirm email". Stores
  // the *id* of another field whose value must match.
  z.object({
    kind: z.literal('matchField'),
    fieldId: z.string().uuid(),
    message: z.string().optional(),
  }),
]);

export type ValidationRule = z.infer<typeof ValidationRule>;

/**
 * Pro-tier conditional logic. Present in v1 schema (so Pro upgrade does not require a schema bump)
 * but evaluated only when the Pro feature flag is on. Free tier ignores the field.
 */
export const ConditionalRule = z.object({
  show: z.boolean(),
  when: z.object({
    fieldId: z.string(),
    operator: z.enum(['equals', 'notEquals', 'contains', 'isEmpty', 'isNotEmpty']),
    value: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
  }),
});

export type ConditionalRule = z.infer<typeof ConditionalRule>;

export const ChoiceOption = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
});

export type ChoiceOption = z.infer<typeof ChoiceOption>;

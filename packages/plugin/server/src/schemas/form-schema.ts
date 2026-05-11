import { z } from 'zod';
import { CoreField } from './field-types';

/**
 * The canonical form schema — every form on disk, every form in transit, and every form
 * in the AI builder's mouth conforms to this. All other surfaces are renderers/editors
 * of this artifact. See resources/05-tech-requirements.md §1.
 *
 * Note: the runtime registry-aware validator (which knows about custom field types)
 * lives in services/form-schema-validator.ts. This Zod schema covers only the core types.
 */

/**
 * The theme (preset + per-property overrides) lives inside settings.theme.
 * Modeled here as z.any().optional() so the lifecycle validator passes it
 * through unchanged — the admin/builder code is the source of truth for the
 * full ThemeConfig type. Defining the strict Zod shape here would force
 * every theme tweak to ripple through this file as well, which is overkill
 * for a JSON payload that's only consumed by the embed runtime.
 */
export const FormSettings = z.object({
  submitButtonLabel: z.string().default('Submit'),
  successMessage: z.string().default('Thank you for your submission.'),
  errorMessage: z.string().default('Something went wrong. Please try again.'),
  redirectUrl: z.string().url().optional(),
  honeypotEnabled: z.boolean().default(true),
  authenticatedOnly: z.boolean().default(false),
  theme: z.any().optional(),
});

export type FormSettings = z.infer<typeof FormSettings>;

export const FormSchemaCore = z.object({
  schemaVersion: z.literal(1),
  // Drafts may be empty; publish enforces at-least-one-field separately.
  fields: z.array(CoreField),
  settings: FormSettings,
});

export type FormSchema = z.infer<typeof FormSchemaCore>;

export { CoreField, CORE_FIELD_TYPES } from './field-types';
export type { CoreFieldType } from './field-types';
export { ValidationRule, ConditionalRule, ChoiceOption } from './validation-rules';

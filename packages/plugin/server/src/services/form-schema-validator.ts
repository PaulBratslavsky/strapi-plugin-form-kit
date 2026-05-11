import { z, ZodError } from 'zod';
import { FormSchemaCore, type FormSchema } from '../schemas/form-schema';
import type { FieldRegistryService } from './field-registry';

/**
 * The runtime schema validator. The Zod schema in schemas/form-schema.ts only knows
 * the 12 core types; this service additionally validates fields whose `type` is registered
 * in the FieldRegistry (custom types from host projects / plugins).
 *
 * Two responsibilities:
 *   1. validateSchema — used by the form lifecycle to validate the form definition itself.
 *   2. validateSubmission — used by the public submit endpoint to validate user-supplied data
 *      against a saved schema.
 */

export type SchemaValidationResult =
  | { ok: true; schema: FormSchema }
  | { ok: false; errors: Array<{ path: string; message: string }> };

export type SubmissionValidationResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; errors: Record<string, string[]> };

const formatZodErrors = (err: ZodError): Array<{ path: string; message: string }> =>
  err.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }));

const service = ({ strapi }: { strapi: any } = { strapi: undefined }) => {
  const getRegistry = (): FieldRegistryService =>
    (strapi ?? globalThis.strapi).plugin('forms').service('fieldRegistry');

  return {
    /**
     * Validate a form definition. Falls through to the registry for unknown field types
     * (i.e. custom types). For each field, additionally validates the per-field config
     * against the registry's configSchema.
     */
    validateSchema(input: unknown): SchemaValidationResult {
      // Step 1: top-level shape (schemaVersion, fields array, settings).
      // We allow unknown field types here — registry will check them next.
      const looseTopLevel = z.object({
        schemaVersion: z.literal(1),
        // Drafts may be empty; publish enforces at-least-one-field separately.
        fields: z.array(z.object({ id: z.string().uuid(), type: z.string().min(1) }).passthrough()),
        settings: FormSchemaCore.shape.settings,
      });

      const topResult = looseTopLevel.safeParse(input);
      if (!topResult.success) {
        return { ok: false, errors: formatZodErrors(topResult.error) };
      }

      const errorsAcc: Array<{ path: string; message: string }> = [];
      const registry = getRegistry();
      const seenIds = new Set<string>();
      const validatedFields: unknown[] = [];

      for (let i = 0; i < topResult.data.fields.length; i++) {
        const field = topResult.data.fields[i];
        if (!field) continue;
        const fieldPath = `fields[${i}]`;

        if (seenIds.has(field.id)) {
          errorsAcc.push({ path: `${fieldPath}.id`, message: `Duplicate field id "${field.id}"` });
          continue;
        }
        seenIds.add(field.id);

        // First, try the core discriminated union — if the type is core, run the strict per-type schema.
        const coreEntry = FormSchemaCore.shape.fields.element.options.find(
          (opt: any) => opt.shape.type._def.value === field.type
        );
        if (coreEntry) {
          const r = (coreEntry as z.ZodTypeAny).safeParse(field);
          if (!r.success) {
            for (const e of formatZodErrors(r.error)) {
              errorsAcc.push({ path: `${fieldPath}.${e.path}`, message: e.message });
            }
          } else {
            validatedFields.push(r.data);
          }
          continue;
        }

        // Otherwise look it up in the registry.
        const reg = registry.get(field.type);
        if (!reg) {
          errorsAcc.push({
            path: `${fieldPath}.type`,
            message: `Unknown field type "${field.type}". Known types: ${[...registry.list().map((r) => r.name)].join(', ') || '(none registered)'}`,
          });
          continue;
        }

        // Validate the editor-side config against configSchema.
        const cfg = reg.configSchema.safeParse(field);
        if (!cfg.success) {
          for (const e of formatZodErrors(cfg.error)) {
            errorsAcc.push({ path: `${fieldPath}.${e.path}`, message: e.message });
          }
          continue;
        }
        validatedFields.push(cfg.data);
      }

      if (errorsAcc.length > 0) {
        return { ok: false, errors: errorsAcc };
      }

      return {
        ok: true,
        schema: {
          schemaVersion: 1,
          fields: validatedFields as FormSchema['fields'],
          settings: topResult.data.settings,
        },
      };
    },

    /**
     * Validate an inbound submission against the form's stored schema.
     * Returns either the cleaned data (only known field IDs, with per-field type-validated
     * values) or a map of fieldId -> error messages.
     */
    validateSubmission(args: {
      schema: FormSchema;
      data: Record<string, unknown>;
    }): SubmissionValidationResult {
      const errs: Record<string, string[]> = {};
      const cleaned: Record<string, unknown> = {};
      const registry = getRegistry();

      for (const field of args.schema.fields) {
        const value = args.data[field.id];
        const required = field.validations?.some((v) => v.kind === 'required') ?? false;
        const isEmpty =
          value === undefined ||
          value === null ||
          value === '' ||
          (Array.isArray(value) && value.length === 0);

        if (isEmpty) {
          if (required) {
            errs[field.id] = [
              field.validations?.find((v) => v.kind === 'required')?.message ?? 'This field is required.',
            ];
          }
          continue;
        }

        // `content` fields are presentational — never carry user input.
        if (field.type === 'content') continue;

        // Per-type value validation: built-in types use built-in coercion, custom types use registry.
        const result = validateValueForType(field, value, registry);
        if (!result.ok) {
          errs[field.id] = result.errors;
          continue;
        }

        // Then run validation rules (minLength, maxLength, pattern, ...).
        const ruleErrors = applyValidationRules(field, result.value);
        if (ruleErrors.length > 0) {
          errs[field.id] = ruleErrors;
          continue;
        }

        cleaned[field.id] = result.value;
      }

      if (Object.keys(errs).length > 0) {
        return { ok: false, errors: errs };
      }
      return { ok: true, data: cleaned };
    },
  };
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^https?:\/\/.+/i;

type FieldLike = { type: string; validations?: Array<any>; options?: Array<{ value: string }> };

const validateValueForType = (
  field: FieldLike,
  value: unknown,
  registry: FieldRegistryService
): { ok: true; value: unknown } | { ok: false; errors: string[] } => {
  switch (field.type) {
    case 'text':
    case 'textarea':
    case 'phone':
    case 'hidden':
      return typeof value === 'string'
        ? { ok: true, value }
        : { ok: false, errors: ['Expected a string.'] };
    case 'email':
      if (typeof value !== 'string') return { ok: false, errors: ['Expected an email string.'] };
      return EMAIL_RE.test(value)
        ? { ok: true, value }
        : { ok: false, errors: ['Please enter a valid email address.'] };
    case 'url':
      if (typeof value !== 'string') return { ok: false, errors: ['Expected a URL string.'] };
      return URL_RE.test(value)
        ? { ok: true, value }
        : { ok: false, errors: ['Please enter a valid URL (http(s)://).'] };
    case 'number': {
      const n = typeof value === 'number' ? value : Number(value);
      return Number.isFinite(n) ? { ok: true, value: n } : { ok: false, errors: ['Expected a number.'] };
    }
    case 'date':
      if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
        return { ok: false, errors: ['Expected a valid date string.'] };
      }
      return { ok: true, value };
    case 'dropdown':
    case 'radio': {
      if (typeof value !== 'string') return { ok: false, errors: ['Expected a single choice value.'] };
      const valid = field.options?.some((o) => o.value === value) ?? false;
      return valid ? { ok: true, value } : { ok: false, errors: ['Selected value is not one of the available options.'] };
    }
    case 'checkboxes': {
      if (!Array.isArray(value)) return { ok: false, errors: ['Expected an array of choice values.'] };
      const allowed = new Set((field.options ?? []).map((o) => o.value));
      const bad = value.filter((v) => typeof v !== 'string' || !allowed.has(v));
      return bad.length === 0
        ? { ok: true, value }
        : { ok: false, errors: ['One or more selected values are not valid options.'] };
    }
    case 'content':
      return { ok: true, value };
    default: {
      // Custom type — defer to registry.
      const r = registry.validateValue(field.type, value);
      return r;
    }
  }
};

const applyValidationRules = (
  field: FieldLike,
  value: unknown
): string[] => {
  const errors: string[] = [];
  for (const rule of field.validations ?? []) {
    switch (rule.kind) {
      case 'required':
        // Already handled outside this function (empty check happens before this).
        break;
      case 'minLength':
        if (typeof value === 'string' && value.length < rule.value) {
          errors.push(rule.message ?? `Must be at least ${rule.value} characters.`);
        } else if (Array.isArray(value) && value.length < rule.value) {
          errors.push(rule.message ?? `Select at least ${rule.value} option(s).`);
        }
        break;
      case 'maxLength':
        if (typeof value === 'string' && value.length > rule.value) {
          errors.push(rule.message ?? `Must be at most ${rule.value} characters.`);
        } else if (Array.isArray(value) && value.length > rule.value) {
          errors.push(rule.message ?? `Select at most ${rule.value} option(s).`);
        }
        break;
      case 'min':
        if (typeof value === 'number' && value < rule.value) {
          errors.push(rule.message ?? `Must be at least ${rule.value}.`);
        }
        break;
      case 'max':
        if (typeof value === 'number' && value > rule.value) {
          errors.push(rule.message ?? `Must be at most ${rule.value}.`);
        }
        break;
      case 'pattern':
        if (typeof value === 'string' && !new RegExp(rule.regex).test(value)) {
          errors.push(rule.message ?? 'Does not match the required pattern.');
        }
        break;
      case 'email':
        if (typeof value === 'string' && !EMAIL_RE.test(value)) {
          errors.push(rule.message ?? 'Please enter a valid email address.');
        }
        break;
      case 'url':
        if (typeof value === 'string' && !URL_RE.test(value)) {
          errors.push(rule.message ?? 'Please enter a valid URL.');
        }
        break;
    }
  }
  return errors;
};

export default service;

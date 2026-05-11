import type { Field, FormSchema, ValidationErrors, ValidationRule } from './types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^https?:\/\/.+/i;

const isEmpty = (v: unknown): boolean =>
  v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

const isRequired = (field: Field) =>
  Array.isArray(field.validations) && field.validations.some((r: ValidationRule) => r.kind === 'required');

/**
 * Client-side mirror of the server's submission validator. The server is the source of truth;
 * this exists to give immediate UI feedback. Anything that passes here may still be rejected
 * server-side (which we surface to the user as a 400 response).
 */
export const validateValues = (
  schema: FormSchema,
  data: Record<string, unknown>
): ValidationErrors => {
  const errors: ValidationErrors = {};
  for (const field of schema.fields) {
    const value = data[field.id];

    if (isEmpty(value)) {
      if (isRequired(field)) {
        const rule = field.validations?.find((r) => r.kind === 'required');
        errors[field.id] = [rule?.message ?? 'This field is required.'];
      }
      continue;
    }

    if (field.type === 'content') continue;

    const typeErr = validateType(field, value);
    if (typeErr) {
      errors[field.id] = [typeErr];
      continue;
    }

    const ruleErrs = applyRules(field, value);
    if (ruleErrs.length > 0) {
      errors[field.id] = ruleErrs;
    }
  }
  return errors;
};

const validateType = (field: Field, value: unknown): string | null => {
  switch (field.type) {
    case 'email':
      return typeof value === 'string' && EMAIL_RE.test(value)
        ? null
        : 'Please enter a valid email address.';
    case 'url':
      return typeof value === 'string' && URL_RE.test(value) ? null : 'Please enter a valid URL.';
    case 'number':
      return Number.isFinite(typeof value === 'number' ? value : Number(value))
        ? null
        : 'Please enter a number.';
    case 'date':
      return typeof value === 'string' && !Number.isNaN(Date.parse(value))
        ? null
        : 'Please enter a valid date.';
    case 'dropdown':
    case 'radio':
      if (typeof value !== 'string') return 'Select an option.';
      return field.options?.some((o) => o.value === value) ? null : 'Select a valid option.';
    case 'checkboxes':
      if (!Array.isArray(value)) return 'Select at least one option.';
      return null;
    default:
      return null;
  }
};

const applyRules = (field: Field, value: unknown): string[] => {
  const out: string[] = [];
  for (const rule of field.validations ?? []) {
    switch (rule.kind) {
      case 'minLength':
        if (typeof value === 'string' && value.length < rule.value)
          out.push(rule.message ?? `Must be at least ${rule.value} characters.`);
        else if (Array.isArray(value) && value.length < rule.value)
          out.push(rule.message ?? `Select at least ${rule.value} option(s).`);
        break;
      case 'maxLength':
        if (typeof value === 'string' && value.length > rule.value)
          out.push(rule.message ?? `Must be at most ${rule.value} characters.`);
        else if (Array.isArray(value) && value.length > rule.value)
          out.push(rule.message ?? `Select at most ${rule.value} option(s).`);
        break;
      case 'min': {
        const n = typeof value === 'number' ? value : Number(value);
        if (Number.isFinite(n) && n < rule.value)
          out.push(rule.message ?? `Must be at least ${rule.value}.`);
        break;
      }
      case 'max': {
        const n = typeof value === 'number' ? value : Number(value);
        if (Number.isFinite(n) && n > rule.value)
          out.push(rule.message ?? `Must be at most ${rule.value}.`);
        break;
      }
      case 'pattern':
        if (typeof value === 'string' && !new RegExp(rule.regex).test(value))
          out.push(rule.message ?? 'Does not match the required pattern.');
        break;
      case 'email':
        if (typeof value === 'string' && !EMAIL_RE.test(value))
          out.push(rule.message ?? 'Please enter a valid email address.');
        break;
      case 'url':
        if (typeof value === 'string' && !URL_RE.test(value))
          out.push(rule.message ?? 'Please enter a valid URL.');
        break;
    }
  }
  return out;
};

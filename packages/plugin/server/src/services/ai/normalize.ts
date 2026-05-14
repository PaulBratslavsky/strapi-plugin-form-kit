/**
 * Deterministic transform from the AI's loose output (see ./loose-schema.ts)
 * to a strict FormSchema. Does all the things small local models can't be
 * trusted to do: stable UUIDs, validations array, alias resolution, label
 * derivation, settings defaults.
 *
 * The model decides *what* fields the form has. This function decides the
 * exact shape on disk.
 */
import crypto from 'crypto';
import type { LooseSchemaInput } from './loose-schema';

const CORE_TYPES = new Set([
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
]);

// Common synonyms small models produce. Map → canonical core type.
const TYPE_ALIASES: Record<string, string> = {
  string: 'text',
  longtext: 'textarea',
  paragraph: 'textarea',
  message: 'textarea',
  tel: 'phone',
  telephone: 'phone',
  select: 'dropdown',
  choice: 'dropdown',
  choices: 'checkboxes',
  multiselect: 'checkboxes',
  multiple: 'checkboxes',
  checkbox: 'checkboxes',
  yesno: 'radio',
  boolean: 'radio',
  bool: 'radio',
  datetime: 'date',
  numeric: 'number',
  int: 'number',
  integer: 'number',
  float: 'number',
  link: 'url',
  website: 'url',
};

const CHOICE_TYPES = new Set(['dropdown', 'radio', 'checkboxes']);

const titleCase = (s: string): string =>
  s
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase split
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();

const coerceType = (raw: unknown): string => {
  const norm = String(raw ?? 'text').toLowerCase().trim();
  if (CORE_TYPES.has(norm)) return norm;
  return TYPE_ALIASES[norm] ?? 'text';
};

const slugify = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

export const looseToFormSchema = (loose: LooseSchemaInput | any) => {
  const fields = (Array.isArray(loose?.fields) ? loose.fields : []).map(
    (f: any, idx: number) => {
      const type = coerceType(f?.type);
      const labelSource =
        (typeof f?.label === 'string' && f.label.trim()) ||
        (typeof f?.name === 'string' && titleCase(f.name)) ||
        `${titleCase(type)} ${idx + 1}`;
      const label = labelSource.trim();

      const validations: Array<Record<string, unknown>> = [];
      if (f?.required === true) {
        validations.push({ kind: 'required', message: `${label} is required.` });
      }
      if (typeof f?.minLength === 'number') {
        validations.push({ kind: 'minLength', value: f.minLength });
      }
      if (typeof f?.maxLength === 'number') {
        validations.push({ kind: 'maxLength', value: f.maxLength });
      }
      if (typeof f?.pattern === 'string') {
        validations.push({ kind: 'pattern', regex: f.pattern });
      }
      // Email/url types get a default format-check validation if not already required.
      if (type === 'email' && !validations.some((v) => v.kind === 'email')) {
        validations.push({ kind: 'email' });
      }
      if (type === 'url' && !validations.some((v) => v.kind === 'url')) {
        validations.push({ kind: 'url' });
      }

      const out: Record<string, unknown> = {
        id: crypto.randomUUID(),
        type,
        label,
        validations,
      };

      const name = typeof f?.name === 'string' ? slugify(f.name) : slugify(label);
      if (name) out.name = name;
      if (typeof f?.placeholder === 'string') out.placeholder = f.placeholder;
      if (typeof f?.helpText === 'string') out.helpText = f.helpText;

      if (CHOICE_TYPES.has(type)) {
        // Collection-backed dropdowns: pass `optionsSource` through and skip
        // the static-options dance entirely. The /schema endpoint's resolver
        // populates `options` at read time with rows from the collection.
        const sourceRaw = f?.optionsSource;
        const isValidSource =
          sourceRaw &&
          typeof sourceRaw === 'object' &&
          typeof sourceRaw.uid === 'string' &&
          typeof sourceRaw.labelField === 'string';

        if (isValidSource) {
          out.optionsSource = {
            kind: 'collection',
            uid: sourceRaw.uid,
            labelField: sourceRaw.labelField,
            valueField:
              typeof sourceRaw.valueField === 'string' ? sourceRaw.valueField : 'documentId',
          };
          // Don't synthesize static options when sourcing from a collection —
          // resolver will populate at runtime.
        } else {
          const rawOptions = Array.isArray(f?.options) ? f.options : [];
          const options = rawOptions
            .map((o: any) => {
              const value =
                (typeof o?.value === 'string' && o.value.trim()) ||
                (typeof o?.label === 'string' && slugify(o.label)) ||
                '';
              const optLabel =
                (typeof o?.label === 'string' && o.label.trim()) ||
                (typeof o?.value === 'string' && titleCase(o.value)) ||
                value;
              return value ? { value, label: optLabel } : null;
            })
            .filter(Boolean);
          // Choice fields with no source need at least one static option as a
          // starting point — synthesize one if missing.
          out.options =
            options.length > 0 ? options : [{ value: 'option_1', label: 'Option 1' }];
        }
      }

      return out;
    }
  );

  return {
    schemaVersion: 1 as const,
    fields,
    settings: {},
  };
};

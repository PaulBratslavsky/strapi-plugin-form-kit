/**
 * MockProvider: deterministic AI substitute used for tests and offline dev.
 *
 * Generates a sensible-looking form schema by keyword-matching the prompt.
 * Doesn't call any external service. Always available, regardless of
 * config, so devs can build and test the chat surface without an API key.
 */
import { v4 as uuid } from 'uuid';
import type { FormSchema } from '../../schemas/form-schema';
import type { AiProvider } from './types';

type Keyword = {
  match: RegExp;
  field: () => FormSchema['fields'][number];
};

const KEYWORDS: Keyword[] = [
  {
    match: /\b(name|first[- ]?name|full[- ]?name)\b/i,
    field: () => ({
      id: uuid(),
      type: 'text',
      label: 'Name',
      validations: [{ kind: 'required' }],
    }),
  },
  {
    match: /\bemail\b/i,
    field: () => ({
      id: uuid(),
      type: 'email',
      label: 'Email address',
      validations: [{ kind: 'required' }, { kind: 'email' }],
    }),
  },
  {
    match: /\b(phone|tel|telephone)\b/i,
    field: () => ({
      id: uuid(),
      type: 'phone',
      label: 'Phone number',
      validations: [],
    }),
  },
  {
    match: /\b(company|org|organization|business)\b/i,
    field: () => ({
      id: uuid(),
      type: 'text',
      label: 'Company',
      validations: [],
    }),
  },
  {
    match: /\b(message|notes?|comment)\b/i,
    field: () => ({
      id: uuid(),
      type: 'textarea',
      label: 'Message',
      rows: 5,
      validations: [{ kind: 'required' }, { kind: 'minLength', value: 10 }],
    }),
  },
  {
    match: /\b(project[- ]?type|service|inquiry[- ]?type|category)\b/i,
    field: () => ({
      id: uuid(),
      type: 'dropdown',
      label: 'Project type',
      options: [
        { label: 'Web', value: 'web' },
        { label: 'Mobile', value: 'mobile' },
        { label: 'Branding', value: 'branding' },
        { label: 'Other', value: 'other' },
      ],
      validations: [{ kind: 'required' }],
    }),
  },
  {
    match: /\bbudget\b/i,
    field: () => ({
      id: uuid(),
      type: 'radio',
      label: 'Budget',
      options: [
        { label: 'Under $5k', value: 'under-5k' },
        { label: '$5k – $20k', value: '5k-20k' },
        { label: '$20k – $50k', value: '20k-50k' },
        { label: '$50k+', value: '50k-plus' },
      ],
      validations: [],
    }),
  },
  {
    match: /\b(date|appointment|book|schedul)/i,
    field: () => ({
      id: uuid(),
      type: 'date',
      label: 'Preferred date',
      validations: [{ kind: 'required' }],
    }),
  },
  {
    match: /\b(url|website|portfolio|link)\b/i,
    field: () => ({
      id: uuid(),
      type: 'url',
      label: 'Website',
      validations: [],
    }),
  },
];

export class MockProvider implements AiProvider {
  readonly id = 'mock';

  async generateForm({ prompt }: { prompt: string }): Promise<FormSchema> {
    const fields: FormSchema['fields'] = [];
    const seen = new Set<string>();
    for (const kw of KEYWORDS) {
      if (kw.match.test(prompt)) {
        const f = kw.field();
        if (seen.has(f.label)) continue;
        seen.add(f.label);
        fields.push(f);
      }
    }
    // Always include name + email as a sane fallback.
    if (!fields.find((f) => f.type === 'text' && /name/i.test(f.label))) {
      fields.unshift({
        id: uuid(),
        type: 'text',
        label: 'Name',
        validations: [{ kind: 'required' }],
      });
    }
    if (!fields.find((f) => f.type === 'email')) {
      const idx = Math.min(1, fields.length);
      fields.splice(idx, 0, {
        id: uuid(),
        type: 'email',
        label: 'Email address',
        validations: [{ kind: 'required' }, { kind: 'email' }],
      });
    }

    return {
      schemaVersion: 1,
      fields,
      settings: {
        submitButtonLabel: /\b(book|reserv)/i.test(prompt) ? 'Book' : 'Send',
        successMessage: 'Thanks — we got your submission!',
        errorMessage: 'Something went wrong. Please try again.',
        honeypotEnabled: true,
        authenticatedOnly: false,
      },
    };
  }

  async refineForm({
    instruction,
    currentSchema,
  }: {
    instruction: string;
    currentSchema: FormSchema;
  }): Promise<FormSchema> {
    // Tiny heuristic: handle "add a <type> field" and "make <field> optional/required".
    const addMatch = instruction.match(/\badd (?:a |an )?(text|textarea|email|number|phone|url|date|dropdown|radio|checkboxes)\b/i);
    if (addMatch) {
      const type = addMatch[1]?.toLowerCase() as FormSchema['fields'][number]['type'];
      return {
        ...currentSchema,
        fields: [
          ...currentSchema.fields,
          {
            id: uuid(),
            type: type ?? 'text',
            label: `${type ?? 'Text'} field`,
            validations: [],
          } as FormSchema['fields'][number],
        ],
      };
    }
    // Default: no-op.
    return currentSchema;
  }

  async streamForm({
    mode,
    prompt,
    currentSchema,
    onChunk,
  }: {
    mode: 'generate' | 'refine';
    prompt: string;
    currentSchema?: FormSchema;
    onChunk: (text: string) => void;
  }): Promise<FormSchema> {
    // Produce the final schema synchronously, then emit the JSON in chunks
    // to give the UI a realistic streaming feel during dev without a real
    // model.
    const schema =
      mode === 'generate'
        ? await this.generateForm({ prompt })
        : await this.refineForm({ instruction: prompt, currentSchema: currentSchema! });
    const text = JSON.stringify(schema, null, 2);
    const chunkSize = 8;
    for (let i = 0; i < text.length; i += chunkSize) {
      onChunk(text.slice(i, i + chunkSize));
      // 30ms × ~text.length/8 ≈ ~1.5s for a typical schema. Feels alive.
      await new Promise((r) => setTimeout(r, 30));
    }
    return schema;
  }

  async streamStyle({
    prompt,
    onChunk,
  }: {
    prompt: string;
    currentTheme?: Record<string, unknown>;
    onChunk: (text: string) => void;
  }): Promise<Record<string, unknown>> {
    // Tiny keyword routing — keeps the dev/test loop alive without an LLM.
    const theme: Record<string, unknown> = {};
    const p = prompt.toLowerCase();
    if (/\bdark\b|\bnight\b|\bmidnight\b/.test(p)) {
      theme.preset = 'bold';
      theme.backgroundColor = '#0a0a14';
      theme.textColor = '#ffffff';
    } else if (/\bfriendly|warm|inviting\b/.test(p)) {
      theme.preset = 'friendly';
      theme.borderRadius = 'lg';
    } else if (/\beditorial|newspaper|serif\b/.test(p)) {
      theme.preset = 'editorial';
      theme.fontFamily = 'serif';
      theme.fieldSpacing = 'relaxed';
    } else if (/\bbold|brutal|strong\b/.test(p)) {
      theme.preset = 'bold';
      theme.fontFamily = 'mono';
      theme.borderRadius = 'none';
    } else {
      theme.preset = 'clean';
    }
    const text = JSON.stringify(theme, null, 2);
    for (let i = 0; i < text.length; i += 6) {
      onChunk(text.slice(i, i + 6));
      await new Promise((r) => setTimeout(r, 25));
    }
    return theme;
  }

  async healthCheck() {
    return { ok: true as const };
  }
}

/**
 * Shared parse pipeline. Every provider funnels raw model output through
 * this: strip fences → carve to outermost {...} → JSON.parse → loose-validate
 * → normalise → strict-validate. Centralised so the streaming and non-
 * streaming paths cannot drift.
 */
import { FormSchemaCore, type FormSchema } from '../../schemas/form-schema';
import { LooseSchema } from './loose-schema';
import { LooseStyleSchema } from './loose-style-schema';
import { looseToFormSchema } from './normalize';
import { looseToTheme } from './normalize-style';

export type ParseResult =
  | { ok: true; schema: FormSchema }
  | { ok: false; error: string };

export type ParseStyleResult =
  | { ok: true; theme: Record<string, unknown> }
  | { ok: false; error: string };

const carveJson = (raw: string): string => {
  let cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) cleaned = cleaned.slice(first, last + 1);
  return cleaned;
};

export const tryParseStyle = (raw: string): ParseStyleResult => {
  const cleaned = carveJson(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    return { ok: false, error: `JSON parse error: ${(err as Error).message}` };
  }
  const loose = LooseStyleSchema.safeParse(parsed);
  if (!loose.success) {
    return {
      ok: false,
      error: loose.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    };
  }
  return { ok: true, theme: looseToTheme(loose.data) };
};

export const tryParseSchema = (raw: string): ParseResult => {
  const cleaned = carveJson(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    return { ok: false, error: `JSON parse error: ${(err as Error).message}` };
  }
  const loose = LooseSchema.safeParse(parsed);
  if (!loose.success) {
    return {
      ok: false,
      error: loose.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    };
  }
  const canonical = looseToFormSchema(loose.data);
  const strict = FormSchemaCore.safeParse(canonical);
  if (!strict.success) {
    return {
      ok: false,
      error:
        'Normaliser produced invalid output: ' +
        strict.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    };
  }
  return { ok: true, schema: strict.data as FormSchema };
};

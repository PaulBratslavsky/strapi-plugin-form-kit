/**
 * Resolves `field.optionsSource` references at /schema read time. Walks a
 * form's fields; for each choice field with an `optionsSource`, fetches
 * the referenced collection, projects each row to `{ label, value }`, and
 * substitutes the result into the field's `options` array before the
 * response is sent. Failures are soft — the field falls back to an empty
 * options array rather than breaking the whole form.
 *
 * Defaults applied silently:
 *   - `valueField` → 'documentId' when omitted
 *   - `status` → 'published' (drafts are never exposed via the public API)
 *   - `pageSize` → 200 (sane cap; if a form needs more, lazy-load is a
 *     follow-up feature)
 */
import type { Core } from '@strapi/strapi';

type OptionsSource = {
  kind: 'collection';
  uid: string;
  labelField: string;
  valueField?: string;
};

type ChoiceField = {
  type: string;
  options?: Array<{ label: string; value: string }>;
  optionsSource?: OptionsSource;
};

const CHOICE_TYPES = new Set(['dropdown', 'radio', 'checkboxes']);
const HARD_LIMIT = 200;

/**
 * Returns a new schema with optionsSource fields resolved to concrete
 * options. The original schema object is not mutated.
 */
export const resolveOptionsSources = async (
  strapi: Core.Strapi,
  schema: { fields?: any[] } | null | undefined
): Promise<typeof schema> => {
  if (!schema || !Array.isArray(schema.fields)) return schema;

  const resolvedFields = await Promise.all(
    schema.fields.map(async (field) => {
      if (!isResolvableChoiceField(field)) return field;
      const resolved = await resolveOneOptionSource(strapi, field.optionsSource!);
      return { ...field, options: resolved };
    })
  );

  return { ...schema, fields: resolvedFields };
};

const isResolvableChoiceField = (f: any): f is ChoiceField & { optionsSource: OptionsSource } =>
  f &&
  typeof f === 'object' &&
  CHOICE_TYPES.has(f.type) &&
  f.optionsSource &&
  typeof f.optionsSource.uid === 'string' &&
  typeof f.optionsSource.labelField === 'string';

/**
 * Resolve a single optionsSource to its `{ label, value }` rows. Exported
 * so the admin "resolve this source on demand" endpoint (powering the
 * Preview & test modal) can call it directly without wrapping a fake
 * one-field schema. `resolveOptionsSources` (whole-schema) delegates here.
 */
export const resolveOneOptionSource = async (
  strapi: Core.Strapi,
  src: OptionsSource
): Promise<Array<{ label: string; value: string }>> => {
  const labelField = src.labelField;
  const valueField = src.valueField ?? 'documentId';

  try {
    const rows = await (strapi.documents(src.uid as any) as any).findMany({
      // Always published — drafts must never reach the public form.
      status: 'published',
      pagination: { pageSize: HARD_LIMIT },
      // Project only the two fields we need + documentId (always returned).
      fields: Array.from(new Set([labelField, valueField, 'documentId'])),
    });

    return (rows ?? [])
      .map((row: Record<string, unknown>) => {
        const labelRaw = row[labelField];
        const valueRaw = valueField === 'documentId' ? row.documentId : row[valueField];
        if (labelRaw === undefined || valueRaw === undefined) return null;
        return {
          label: String(labelRaw),
          value: String(valueRaw),
        };
      })
      .filter((o: unknown): o is { label: string; value: string } => o !== null);
  } catch (err) {
    strapi.log.warn(
      `[forms] failed to resolve options source ${src.uid}: ${(err as Error).message}`
    );
    return [];
  }
};

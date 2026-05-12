import { errors } from '@strapi/utils';
import type { Core } from '@strapi/strapi';

const { NotFoundError, ValidationError } = errors;

/**
 * Admin-side controllers backing the visual builder, settings page, etc.
 * Mounted under /forms-plugin/admin/...
 */
/**
 * Returns the publish timestamp by querying the *published* entry directly.
 * In Strapi v5 D&P, the draft entry always has `publishedAt: null`; the published
 * entry is a sibling with a non-null `publishedAt`. The admin UI needs the
 * published timestamp regardless of which version we're reading.
 */
const fetchPublishedAt = async (
  strapi: Core.Strapi,
  documentId: string
): Promise<string | null> => {
  const published = await strapi
    .documents('plugin::forms.form')
    .findOne({ documentId, status: 'published' as any } as any);
  return (published as any)?.publishedAt ?? null;
};

const controller = ({ strapi }: { strapi: Core.Strapi }) => ({
  /** GET /forms-plugin/admin/forms — list all forms (draft + published). */
  async list(ctx: any) {
    const { q, status, page = '1', pageSize = '50' } = ctx.query ?? {};

    const filters: Record<string, unknown> = {};
    if (q) filters.name = { $containsi: q };

    const forms = await strapi.documents('plugin::forms.form').findMany({
      filters: filters as any,
      sort: [{ updatedAt: 'desc' }] as any,
      status: status === 'draft' ? 'draft' : status === 'published' ? 'published' : undefined,
      pagination: { page: Number(page), pageSize: Number(pageSize) } as any,
    } as any);

    // Annotate each form with submission counts and the real publish timestamp.
    const annotated = await Promise.all(
      forms.map(async (form: any) => {
        const total = await strapi.documents('plugin::forms.submission').count({
          filters: { form: { documentId: form.documentId } } as any,
        } as any);
        const newCount = await strapi.documents('plugin::forms.submission').count({
          filters: { form: { documentId: form.documentId }, status: 'submitted' } as any,
        } as any);
        const publishedAt = await fetchPublishedAt(strapi, form.documentId);
        return {
          documentId: form.documentId,
          name: form.name,
          slug: form.slug,
          description: form.description ?? null,
          publishedAt,
          updatedAt: form.updatedAt,
          fieldCount: Array.isArray(form.schema?.fields) ? form.schema.fields.length : 0,
          submissionCount: total,
          newSubmissionCount: newCount,
        };
      })
    );

    ctx.body = { data: annotated };
  },

  /** GET /forms-plugin/admin/forms/:documentId — read one form (its full schema). */
  async findOne(ctx: any) {
    const { documentId } = ctx.params;
    const form = await strapi
      .documents('plugin::forms.form')
      .findOne({ documentId, status: 'draft' as any } as any);
    if (!form) throw new NotFoundError('Form not found');
    const publishedAt = await fetchPublishedAt(strapi, documentId);
    ctx.body = { data: { ...form, publishedAt } };
  },

  /** POST /forms-plugin/admin/forms — create a new draft form. */
  async create(ctx: any) {
    const body = ctx.request.body ?? {};
    const data = body.data ?? body;

    if (!data.name) throw new ValidationError('Field "name" is required.');
    if (!data.slug) throw new ValidationError('Field "slug" is required.');
    if (!data.schema) {
      data.schema = { schemaVersion: 1, fields: [], settings: {} };
    }

    const form = await strapi.documents('plugin::forms.form').create({ data } as any);
    ctx.status = 201;
    ctx.body = { data: form };
  },

  /** PUT /forms-plugin/admin/forms/:documentId — update a form's metadata + schema. */
  async update(ctx: any) {
    const { documentId } = ctx.params;
    const body = ctx.request.body ?? {};
    const data = body.data ?? body;
    const form = await strapi
      .documents('plugin::forms.form')
      .update({ documentId, data } as any);
    if (!form) throw new NotFoundError('Form not found');
    ctx.body = { data: form };
  },

  /** POST /forms-plugin/admin/forms/:documentId/publish — publish or unpublish. */
  async publish(ctx: any) {
    const { documentId } = ctx.params;
    const action = ctx.request.body?.action ?? 'publish';
    if (action === 'unpublish') {
      const form = await strapi.documents('plugin::forms.form').unpublish({ documentId } as any);
      ctx.body = { data: { ...form, publishedAt: null } };
      return;
    }
    const result = await strapi.documents('plugin::forms.form').publish({ documentId } as any);
    const publishedAt = await fetchPublishedAt(strapi, documentId);
    ctx.body = { data: { ...result, publishedAt } };
  },

  /** DELETE /forms-plugin/admin/forms/:documentId — delete a form (and its submissions cascade). */
  async delete(ctx: any) {
    const { documentId } = ctx.params;
    await strapi.documents('plugin::forms.form').delete({ documentId } as any);
    ctx.status = 204;
  },

  /** POST /forms-plugin/admin/forms/:documentId/duplicate — duplicate within the project. */
  async duplicate(ctx: any) {
    const { documentId } = ctx.params;
    const original = await strapi
      .documents('plugin::forms.form')
      .findOne({ documentId, status: 'draft' as any } as any);
    if (!original) throw new NotFoundError('Form not found');

    const copy = await strapi.documents('plugin::forms.form').create({
      data: {
        name: `${original.name} (copy)`,
        slug: `${original.slug}-copy-${Date.now()}`,
        description: original.description,
        schema: original.schema,
      },
    } as any);
    ctx.status = 201;
    ctx.body = { data: copy };
  },

  /**
   * GET /forms-plugin/admin/content-types — list api::* and plugin::* collection
   * types eligible for `optionsSource` dropdowns. Returns each type's UID,
   * display info, and string-typed attributes (candidates for labelField).
   * Used by the dropdown config UI to populate the collection picker.
   */
  async contentTypes(ctx: any) {
    const out: Array<{
      uid: string;
      displayName: string;
      kind: 'collectionType' | 'singleType';
      stringAttributes: string[];
    }> = [];

    for (const [uid, ct] of Object.entries(strapi.contentTypes as Record<string, any>)) {
      // Only expose collection types from api::* and plugin namespaces — never
      // admin::* (users, permissions) or internal Strapi types.
      if (!uid.startsWith('api::') && !uid.startsWith('plugin::')) continue;
      if (ct.kind !== 'collectionType') continue;
      // Hide our own plugin's internal types from the picker.
      if (uid.startsWith('plugin::forms.') || uid.startsWith('plugin::upload.')) continue;

      const stringAttributes = Object.entries(ct.attributes ?? {})
        .filter(([, attr]: [string, any]) =>
          ['string', 'text', 'uid', 'email'].includes(attr?.type)
        )
        .map(([name]) => name);

      out.push({
        uid,
        displayName: ct.info?.displayName ?? ct.info?.singularName ?? uid,
        kind: 'collectionType',
        stringAttributes,
      });
    }

    out.sort((a, b) => a.displayName.localeCompare(b.displayName));
    ctx.body = { data: out };
  },

  /** GET /forms-plugin/admin/field-types — list registered field types for the builder palette. */
  async fieldTypes(ctx: any) {
    const registry = strapi.plugin('forms').service('fieldRegistry');
    const list = registry.list();
    ctx.body = {
      data: list.map((entry: any) => ({
        name: entry.name,
        plugin: entry.plugin,
        storageType: entry.storageType,
        aiHint: entry.aiHint,
      })),
    };
  },

  /** GET /forms/admin/forms/:documentId/copy-as-ai-prompt — pre-built LLM prompt. */
  async copyAsAiPrompt(ctx: any) {
    const { documentId } = ctx.params;
    const form = await strapi
      .documents('plugin::forms.form')
      .findOne({ documentId, status: 'draft' as any } as any);
    if (!form) throw new NotFoundError('Form not found');

    const prompt = buildAiPrompt({ name: form.name, slug: form.slug, schema: form.schema });
    ctx.body = { data: { prompt } };
  },
});

/**
 * Build the prompt string. Bundles the form schema and tells the LLM to produce a
 * framework-native (e.g. React + Tailwind) component. The "Copy" button on the form
 * edit view just copies this string to the clipboard.
 */
const buildAiPrompt = (form: { name: string; slug: string; schema: any }) => {
  return `You are a senior frontend engineer. Generate a production-quality form component for the following Strapi Forms schema.

## Form metadata
- Name: ${form.name}
- Slug: ${form.slug}
- Public schema URL: GET /api/forms/${form.slug}/schema
- Public submit URL: POST /api/forms/${form.slug}/submit

## Canonical schema (the contract)
\`\`\`json
${JSON.stringify(form.schema, null, 2)}
\`\`\`

## What to generate
Produce a single self-contained component (in the framework I'm using — ask if unsure) that:
1. Renders a label + appropriate input for each field in \`schema.fields\`, in the order given.
2. Honors each field's \`type\`, \`placeholder\`, \`helpText\`, \`validations\`, and type-specific properties (\`options\`, \`rows\`, \`step\`, \`min\`, \`max\`).
3. Validates client-side: respects \`required\`, \`minLength\`, \`maxLength\`, \`min\`, \`max\`, \`pattern\`, \`email\`, \`url\` rules — and shows error messages from the rule's \`message\` if present.
4. On submit, POSTs JSON to the submit URL with body \`{ "data": { "<fieldId>": <value>, ... }, "honeypot": "" }\`.
5. Honors \`settings.submitButtonLabel\`, \`settings.successMessage\`, \`settings.errorMessage\`, and \`settings.redirectUrl\`.
6. If \`settings.honeypotEnabled\` is true, includes a hidden \`honeypot\` input that real users won't fill.
7. Surfaces server validation errors (HTTP 400 with body \`{ errors: { "<fieldId>": ["msg"] } }\`) under the matching field.
8. Uses the project's design system / utility classes for styling. Otherwise, plain semantic HTML.

Use \`field.id\` (UUID) as the form name attribute and as the key in the submitted \`data\` object — never the label, since labels can change.

If the framework or styling system is unclear, ask before generating.`;
};

export default controller;

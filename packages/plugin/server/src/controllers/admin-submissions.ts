import { errors } from '@strapi/utils';
import type { Core } from '@strapi/strapi';

const { NotFoundError, ValidationError } = errors;

const ALLOWED_STATUSES = new Set(['submitted', 'read', 'spam']);

const buildFilters = (form: any, query: Record<string, any>) => {
  // Filter by documentId so we catch submissions regardless of which form
  // version (draft / published) was their target — both share the documentId
  // in Strapi v5's draft & publish model.
  const filters: Record<string, any> = { form: { documentId: form.documentId } };
  if (query.status && ALLOWED_STATUSES.has(String(query.status))) {
    filters.status = query.status;
  }
  if (query.from || query.to) {
    filters.createdAt = {};
    if (query.from) filters.createdAt.$gte = new Date(query.from);
    if (query.to) filters.createdAt.$lte = new Date(query.to);
  }
  if (query.q) {
    // Strapi 5 SQLite supports $containsi on JSON via underlying like(' %text% ').
    // Cast the JSON to text and substring-match.
    filters.data = { $containsi: String(query.q) };
  }
  return filters;
};

const controller = ({ strapi }: { strapi: Core.Strapi }) => ({
  /** GET /forms/admin/forms/:formDocumentId/submissions — list with filters. */
  async list(ctx: any) {
    const { formDocumentId } = ctx.params;
    const { page = '1', pageSize = '50' } = ctx.query ?? {};
    const form = await strapi
      .documents('plugin::forms.form')
      .findOne({ documentId: formDocumentId, status: 'draft' as any } as any);
    if (!form) throw new NotFoundError('Form not found');

    const filters = buildFilters(form, ctx.query);

    const items = await strapi.entityService.findMany('plugin::forms.submission' as any, {
      filters,
      sort: [{ createdAt: 'desc' }],
      pagination: { page: Number(page), pageSize: Number(pageSize) },
    } as any);

    const total = await strapi.entityService.count('plugin::forms.submission' as any, {
      filters,
    } as any);

    // Per-status counts for tab badges.
    const formFilter = { form: { documentId: form.documentId } };
    const counts = {
      submitted: await strapi.entityService.count('plugin::forms.submission' as any, {
        filters: { ...formFilter, status: 'submitted' },
      } as any),
      read: await strapi.entityService.count('plugin::forms.submission' as any, {
        filters: { ...formFilter, status: 'read' },
      } as any),
      spam: await strapi.entityService.count('plugin::forms.submission' as any, {
        filters: { ...formFilter, status: 'spam' },
      } as any),
    };

    ctx.body = {
      data: items,
      meta: { total, counts, form: { name: form.name, slug: form.slug, schema: form.schema } },
    };
  },

  /** POST /forms/admin/submissions/:documentId/status — update status (submitted/read/spam). */
  async setStatus(ctx: any) {
    const { documentId } = ctx.params;
    const { status } = ctx.request.body ?? {};
    if (!ALLOWED_STATUSES.has(status)) {
      throw new ValidationError(`Status must be one of ${[...ALLOWED_STATUSES].join(', ')}`);
    }
    const updated = await strapi.documents('plugin::forms.submission').update({
      documentId,
      data: { status } as any,
    } as any);
    ctx.body = { data: updated };
  },

  /** POST /forms/admin/submissions/bulk — bulk status / delete actions. */
  async bulk(ctx: any) {
    const { action, documentIds } = ctx.request.body ?? {};
    if (!Array.isArray(documentIds) || documentIds.length === 0) {
      throw new ValidationError('documentIds must be a non-empty array');
    }
    if (action === 'delete') {
      for (const id of documentIds) {
        await strapi.documents('plugin::forms.submission').delete({ documentId: id } as any);
      }
      ctx.body = { data: { deleted: documentIds.length } };
      return;
    }
    if (typeof action === 'string' && action.startsWith('status:')) {
      const status = action.slice('status:'.length);
      if (!ALLOWED_STATUSES.has(status)) throw new ValidationError(`Invalid status "${status}"`);
      for (const id of documentIds) {
        await strapi
          .documents('plugin::forms.submission')
          .update({ documentId: id, data: { status } as any } as any);
      }
      ctx.body = { data: { updated: documentIds.length, status } };
      return;
    }
    throw new ValidationError(`Unknown bulk action "${action}"`);
  },

  /** DELETE /forms/admin/submissions/:documentId — single delete. */
  async delete(ctx: any) {
    const { documentId } = ctx.params;
    await strapi.documents('plugin::forms.submission').delete({ documentId } as any);
    ctx.status = 204;
  },

  /** GET /forms/admin/forms/:formDocumentId/export.csv — CSV export. */
  async exportCsv(ctx: any) {
    const { formDocumentId } = ctx.params;
    const form = await strapi
      .documents('plugin::forms.form')
      .findOne({ documentId: formDocumentId, status: 'draft' as any } as any);
    if (!form) throw new NotFoundError('Form not found');

    const filters = buildFilters(form, ctx.query);

    const items = (await strapi.entityService.findMany('plugin::forms.submission' as any, {
      filters,
      sort: [{ createdAt: 'desc' }],
      pagination: { pageSize: 10_000 },
    } as any)) as any[];

    const fields = (form.schema?.fields ?? []) as Array<{ id: string; label: string; type: string }>;
    const inputFields = fields.filter((f) => f.type !== 'content');

    const escape = (v: unknown): string => {
      if (v === undefined || v === null) return '';
      const s = Array.isArray(v) ? v.join('; ') : typeof v === 'object' ? JSON.stringify(v) : String(v);
      // RFC 4180: wrap in quotes if it contains ", , or newline; double internal quotes.
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    const header = [
      'submissionId',
      'createdAt',
      'status',
      ...inputFields.map((f) => f.label),
    ].map(escape);

    const rows = items.map((item) => {
      const row = [item.documentId ?? item.id, item.createdAt, item.status];
      for (const f of inputFields) row.push((item.data ?? {})[f.id]);
      return row.map(escape);
    });

    const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');

    ctx.set('Content-Type', 'text/csv; charset=utf-8');
    ctx.set('Content-Disposition', `attachment; filename="${form.slug}-submissions.csv"`);
    ctx.body = csv;
  },

  /** GET /forms/admin/forms/sidebar-badge — total new (status=submitted) across all forms. */
  async sidebarBadge(ctx: any) {
    const total = await strapi.entityService.count('plugin::forms.submission' as any, {
      filters: { status: 'submitted' },
    } as any);
    ctx.body = { data: { newSubmissions: total } };
  },
});

export default controller;

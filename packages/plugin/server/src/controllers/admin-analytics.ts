import { errors } from '@strapi/utils';
import type { Core } from '@strapi/strapi';
import type { AnalyticsReport } from '../services/analytics/types';

const { NotFoundError } = errors;

const RANGE_DAYS: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90, all: 365 };

const utcDayKey = (d: Date): string => d.toISOString().slice(0, 10);

const resolveRange = (range: unknown): { fromDay: string; toDay: string } => {
  const days = RANGE_DAYS[String(range)] ?? 30;
  const today = new Date();
  const from = new Date(today);
  from.setUTCDate(from.getUTCDate() - (days - 1));
  return { fromDay: utcDayKey(from), toDay: utcDayKey(today) };
};

const fieldLabelsOf = (form: any): Record<string, string> => {
  const labels: Record<string, string> = {};
  for (const f of form.schema?.fields ?? []) {
    if (f?.id) labels[f.id] = f.label ?? f.id;
  }
  return labels;
};

const toCsv = (report: AnalyticsReport): string => {
  const head = 'day,views,submits';
  const body = report.series.map((r) => `${r.day},${r.views},${r.submits}`).join('\n');
  return `${head}\n${body}\n`;
};

/**
 * Admin analytics endpoints. Mounted under the plugin admin prefix and guarded
 * by `admin::isAuthenticatedAdmin` (see routes/admin.ts).
 */
const controller = ({ strapi }: { strapi: Core.Strapi }) => ({
  /** GET /admin/forms/:formDocumentId/analytics?range=7d|30d|90d|all */
  async report(ctx: any) {
    const { formDocumentId } = ctx.params;
    const form = await strapi
      .documents('plugin::forms.form')
      .findOne({ documentId: formDocumentId, status: 'draft' as any } as any);
    if (!form) throw new NotFoundError('Form not found');

    const { fromDay, toDay } = resolveRange(ctx.query?.range);
    const report = await strapi
      .plugin('forms')
      .service('analytics')
      .getReport(formDocumentId, fromDay, toDay, fieldLabelsOf(form));

    ctx.body = { data: report };
  },

  /** GET /admin/forms/:formDocumentId/analytics/export.csv?range=30d */
  async exportCsv(ctx: any) {
    const { formDocumentId } = ctx.params;
    const form = await strapi
      .documents('plugin::forms.form')
      .findOne({ documentId: formDocumentId, status: 'draft' as any } as any);
    if (!form) throw new NotFoundError('Form not found');

    const { fromDay, toDay } = resolveRange(ctx.query?.range);
    const report = await strapi
      .plugin('forms')
      .service('analytics')
      .getReport(formDocumentId, fromDay, toDay, fieldLabelsOf(form));

    ctx.set('Content-Type', 'text/csv; charset=utf-8');
    ctx.set(
      'Content-Disposition',
      `attachment; filename="analytics-${form.slug ?? formDocumentId}-${fromDay}_${toDay}.csv"`
    );
    ctx.body = toCsv(report);
  },
});

export default controller;

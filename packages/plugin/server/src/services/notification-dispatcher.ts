import { v4 as uuid } from 'uuid';
import type { Core } from '@strapi/strapi';
import { TABLE_NAMES } from '../database/migrations/0001-create-delivery-logs';

/**
 * Renders a {{fieldId}} / {{fieldLabel}} / {{all}} template against a submission's data
 * and the form schema's labels. Unknown placeholders are left as-is.
 */
export const renderTemplate = (
  template: string,
  args: { data: Record<string, unknown>; labelByFieldId: Map<string, string> }
): string => {
  return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, expr) => {
    const key = String(expr).trim();
    if (key === 'all') {
      const lines: string[] = [];
      for (const [fieldId, label] of args.labelByFieldId.entries()) {
        const v = args.data[fieldId];
        const printed =
          v === undefined || v === null
            ? ''
            : Array.isArray(v)
              ? v.join(', ')
              : typeof v === 'object'
                ? JSON.stringify(v)
                : String(v);
        lines.push(`${label}: ${printed}`);
      }
      return lines.join('\n');
    }
    if (key.startsWith('fieldLabel:')) {
      const id = key.slice('fieldLabel:'.length).trim();
      return args.labelByFieldId.get(id) ?? '';
    }
    // Treat the expression as a field id; fall back to label lookup if no value found.
    const v = args.data[key];
    if (v === undefined && args.labelByFieldId.has(key)) {
      // Asking for the label by its id, not value.
      return args.labelByFieldId.get(key) ?? '';
    }
    if (v === undefined || v === null) return '';
    if (Array.isArray(v)) return v.join(', ');
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  });
};

const service = ({ strapi }: { strapi: Core.Strapi } = { strapi: undefined as any }) => {
  const $strapi: Core.Strapi = strapi ?? (globalThis as any).strapi;

  const log = async (entry: {
    rule_id: number;
    submission_id: number;
    recipients: string[];
    status: 'success' | 'failed';
    error?: string;
  }) => {
    try {
      await $strapi.db.connection(TABLE_NAMES.NOTIFICATION).insert({
        id: uuid(),
        notification_rule_id: entry.rule_id,
        submission_id: entry.submission_id,
        recipients: JSON.stringify(entry.recipients),
        status: entry.status,
        error_message: entry.error ?? null,
        attempted_at: new Date(),
      });
    } catch (err) {
      $strapi.log.warn(
        `[strapi-plugin-forms] could not write notification delivery log: ${(err as Error).message}`
      );
    }
  };

  return {
    /**
     * Synchronously dispatch all enabled notification rules for the form. Errors are
     * captured to the delivery log; they never propagate to the caller (so the public
     * submission response always succeeds).
     */
    async dispatchAllForSubmission(args: { formDocumentId: string; submissionId: number }) {
      const submission = await $strapi.entityService.findOne(
        'plugin::forms.submission' as any,
        args.submissionId,
        { populate: { form: true } } as any
      );
      if (!submission) return;
      const form: any = (submission as any).form;
      if (!form) return;

      const rules = await $strapi.entityService.findMany('plugin::forms.notification-rule' as any, {
        // Match by documentId so we find rules regardless of which form version
        // (draft / published) was their target.
        filters: { form: { documentId: form.documentId }, enabled: true },
      } as any);

      const labelByFieldId = new Map<string, string>();
      for (const f of form.schema?.fields ?? []) {
        if (f.id && f.label) labelByFieldId.set(f.id, f.label);
      }

      for (const rule of rules as any[]) {
        const recipients = (rule.recipients as string[]) ?? [];
        if (!Array.isArray(recipients) || recipients.length === 0) continue;
        const subject = renderTemplate(rule.subjectTemplate ?? '', {
          data: (submission as any).data ?? {},
          labelByFieldId,
        });
        const body = renderTemplate(rule.bodyTemplate ?? '', {
          data: (submission as any).data ?? {},
          labelByFieldId,
        });

        try {
          await $strapi.plugin('email').service('email').send({
            to: recipients,
            subject,
            text: body,
          });
          await log({
            rule_id: rule.id,
            submission_id: args.submissionId,
            recipients,
            status: 'success',
          });
        } catch (err) {
          $strapi.log.warn(
            `[strapi-plugin-forms] notification rule ${rule.id} failed: ${(err as Error).message}`
          );
          await log({
            rule_id: rule.id,
            submission_id: args.submissionId,
            recipients,
            status: 'failed',
            error: (err as Error).message,
          });
        }
      }
    },

    async listDeliveriesForRule(ruleId: number, limit: number = 50) {
      return $strapi.db
        .connection(TABLE_NAMES.NOTIFICATION)
        .where('notification_rule_id', ruleId)
        .orderBy('attempted_at', 'desc')
        .limit(limit);
    },
  };
};

export default service;

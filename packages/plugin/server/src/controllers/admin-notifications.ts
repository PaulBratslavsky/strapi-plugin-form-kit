import { errors } from '@strapi/utils';
import type { Core } from '@strapi/strapi';

const { NotFoundError, ValidationError } = errors;

const controller = ({ strapi }: { strapi: Core.Strapi }) => ({
  /** GET /forms/admin/forms/:formDocumentId/notifications — list rules for a form. */
  async list(ctx: any) {
    const { formDocumentId } = ctx.params;
    const form = await strapi
      .documents('plugin::forms.form')
      .findOne({ documentId: formDocumentId, status: 'draft' as any } as any);
    if (!form) throw new NotFoundError('Form not found');

    const rules = await strapi.entityService.findMany('plugin::forms.notification-rule' as any, {
      filters: { form: form.id },
      sort: { id: 'asc' as any },
    } as any);
    ctx.body = { data: rules };
  },

  /** POST /forms/admin/forms/:formDocumentId/notifications — create a rule. */
  async create(ctx: any) {
    const { formDocumentId } = ctx.params;
    const body = ctx.request.body ?? {};
    const data = body.data ?? body;

    if (!data.name) throw new ValidationError('Rule name is required.');
    if (!Array.isArray(data.recipients) || data.recipients.length === 0)
      throw new ValidationError('At least one recipient email is required.');

    const form = await strapi
      .documents('plugin::forms.form')
      .findOne({ documentId: formDocumentId, status: 'draft' as any } as any);
    if (!form) throw new NotFoundError('Form not found');

    const rule = await strapi.entityService.create('plugin::forms.notification-rule' as any, {
      data: {
        form: form.id,
        name: data.name,
        recipients: data.recipients,
        subjectTemplate: data.subjectTemplate ?? `New submission to ${form.name}`,
        bodyTemplate: data.bodyTemplate ?? '{{all}}',
        enabled: data.enabled ?? true,
      },
    } as any);
    ctx.status = 201;
    ctx.body = { data: rule };
  },

  /** PUT /forms/admin/notifications/:id — update a rule. */
  async update(ctx: any) {
    const { id } = ctx.params;
    const body = ctx.request.body ?? {};
    const data = body.data ?? body;
    const rule = await strapi.entityService.update('plugin::forms.notification-rule' as any, id, {
      data,
    } as any);
    if (!rule) throw new NotFoundError('Rule not found');
    ctx.body = { data: rule };
  },

  /** DELETE /forms/admin/notifications/:id — delete a rule. */
  async delete(ctx: any) {
    const { id } = ctx.params;
    await strapi.entityService.delete('plugin::forms.notification-rule' as any, id);
    ctx.status = 204;
  },

  /** GET /forms/admin/notifications/:id/deliveries — recent delivery log entries. */
  async deliveries(ctx: any) {
    const { id } = ctx.params;
    const dispatcher = strapi.plugin('forms').service('notificationDispatcher');
    const deliveries = await dispatcher.listDeliveriesForRule(Number(id), 100);
    ctx.body = { data: deliveries };
  },
});

export default controller;

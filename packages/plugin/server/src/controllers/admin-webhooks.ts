import { errors } from '@strapi/utils';
import type { Core } from '@strapi/strapi';
import { encrypt } from '../utils/encryption';

const { NotFoundError, ValidationError } = errors;

const sanitize = (cfg: any) => {
  const { hmacSecretEncrypted, ...rest } = cfg ?? {};
  return { ...rest, hmacConfigured: Boolean(hmacSecretEncrypted) };
};

const controller = ({ strapi }: { strapi: Core.Strapi }) => ({
  async list(ctx: any) {
    const { formDocumentId } = ctx.params;
    const form = await strapi
      .documents('plugin::forms.form')
      .findOne({ documentId: formDocumentId, status: 'draft' as any } as any);
    if (!form) throw new NotFoundError('Form not found');

    const configs = await strapi.entityService.findMany('plugin::forms.webhook-config' as any, {
      filters: { form: form.id },
      sort: { id: 'asc' as any },
    } as any);
    ctx.body = { data: (configs as any[]).map(sanitize) };
  },

  async create(ctx: any) {
    const { formDocumentId } = ctx.params;
    const body = ctx.request.body ?? {};
    const data = body.data ?? body;

    if (!data.name) throw new ValidationError('Webhook name is required.');
    if (!data.url || !/^https?:\/\//.test(data.url))
      throw new ValidationError('A valid http(s) URL is required.');

    const form = await strapi
      .documents('plugin::forms.form')
      .findOne({ documentId: formDocumentId, status: 'draft' as any } as any);
    if (!form) throw new NotFoundError('Form not found');

    const created = await strapi.entityService.create('plugin::forms.webhook-config' as any, {
      data: {
        form: form.id,
        name: data.name,
        url: data.url,
        method: data.method ?? 'POST',
        headers: data.headers ?? {},
        hmacSecretEncrypted: data.hmacSecret ? encrypt(String(data.hmacSecret)) : null,
        enabled: data.enabled ?? true,
      },
    } as any);

    ctx.status = 201;
    ctx.body = { data: sanitize(created) };
  },

  async update(ctx: any) {
    const { id } = ctx.params;
    const body = ctx.request.body ?? {};
    const data = body.data ?? body;

    const patch: Record<string, unknown> = {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.url !== undefined && { url: data.url }),
      ...(data.method !== undefined && { method: data.method }),
      ...(data.headers !== undefined && { headers: data.headers }),
      ...(data.enabled !== undefined && { enabled: data.enabled }),
    };
    if (data.hmacSecret !== undefined) {
      patch.hmacSecretEncrypted = data.hmacSecret ? encrypt(String(data.hmacSecret)) : null;
    }

    const updated = await strapi.entityService.update('plugin::forms.webhook-config' as any, id, {
      data: patch,
    } as any);
    if (!updated) throw new NotFoundError('Webhook config not found');
    ctx.body = { data: sanitize(updated) };
  },

  async delete(ctx: any) {
    const { id } = ctx.params;
    await strapi.entityService.delete('plugin::forms.webhook-config' as any, id);
    ctx.status = 204;
  },

  async deliveries(ctx: any) {
    const { id } = ctx.params;
    const dispatcher = strapi.plugin('forms').service('webhookDispatcher');
    const deliveries = await dispatcher.getRecentDeliveries({ webhookConfigId: Number(id), limit: 100 });
    ctx.body = { data: deliveries };
  },
});

export default controller;

import { errors } from '@strapi/utils';
import type { Core } from '@strapi/strapi';
import { encrypt } from '../utils/encryption';
import { streamSSE } from '../utils/sse';

const { ValidationError } = errors;

const controller = ({ strapi }: { strapi: Core.Strapi }) => ({
  /** POST /forms/admin/ai/generate — natural language → FormSchema. */
  async generate(ctx: any) {
    const body = ctx.request.body ?? {};
    const prompt = String(body.prompt ?? '').trim();
    if (!prompt) throw new ValidationError('prompt is required');
    try {
      const schema = await strapi.plugin('forms').service('ai').generate(prompt);
      ctx.body = { data: { schema } };
    } catch (err) {
      ctx.status = 502;
      ctx.body = { error: { message: (err as Error).message } };
    }
  },

  /**
   * POST /forms/admin/ai/stream — Server-Sent Events.
   *
   * Body: {
   *   target: 'layout' | 'style',
   *   mode: 'generate' | 'refine',
   *   prompt: string,
   *   currentSchema?: FormSchema,
   *   currentTheme?: ThemeConfig
   * }
   * Events emitted:
   *   data: {"type":"chunk","text":"..."}                              // token delta
   *   data: {"type":"done","target":"layout","schema":{...}}           // layout done
   *   data: {"type":"done","target":"style","theme":{...}}             // style done
   *   data: {"type":"error","error":"..."}                             // fatal
   */
  async stream(ctx: any) {
    const body = ctx.request.body ?? {};
    const target: 'layout' | 'style' = body.target === 'style' ? 'style' : 'layout';
    const mode: 'generate' | 'refine' = body.mode === 'refine' ? 'refine' : 'generate';
    const prompt = String(body.prompt ?? '').trim();
    if (!prompt) throw new ValidationError('prompt is required');
    if (target === 'layout' && mode === 'refine' && (!body.currentSchema || typeof body.currentSchema !== 'object')) {
      throw new ValidationError('currentSchema is required for layout refine');
    }

    await streamSSE(ctx, async (emit, signal) => {
      const result = await strapi
        .plugin('forms')
        .service('ai')
        .stream({
          target,
          mode,
          prompt,
          currentSchema: body.currentSchema,
          currentTheme: body.currentTheme,
          onChunk: (text: string) => emit({ type: 'chunk', text }),
        });
      if (signal.aborted) return;
      if (result.target === 'style') {
        emit({ type: 'done', target: 'style', theme: result.theme });
      } else {
        emit({ type: 'done', target: 'layout', schema: result.schema });
      }
    });
  },

  /** POST /forms/admin/ai/refine — { instruction, currentSchema } → FormSchema. */
  async refine(ctx: any) {
    const body = ctx.request.body ?? {};
    const instruction = String(body.instruction ?? '').trim();
    const currentSchema = body.currentSchema;
    if (!instruction) throw new ValidationError('instruction is required');
    if (!currentSchema || typeof currentSchema !== 'object') {
      throw new ValidationError('currentSchema is required');
    }
    try {
      const schema = await strapi
        .plugin('forms')
        .service('ai')
        .refine(instruction, currentSchema);
      ctx.body = { data: { schema } };
    } catch (err) {
      ctx.status = 502;
      ctx.body = { error: { message: (err as Error).message } };
    }
  },

  /** GET /forms/admin/ai/health — provider reachability. */
  async health(ctx: any) {
    const result = await strapi.plugin('forms').service('ai').healthCheck();
    ctx.body = { data: result };
  },

  /** GET /forms/admin/ai/config — returns current config (without revealing the key). */
  async getConfig(ctx: any) {
    const config = await strapi.plugin('forms').service('ai').describe();
    ctx.body = { data: config };
  },

  /** PUT /forms/admin/ai/config — update provider settings. */
  async updateConfig(ctx: any) {
    const body = ctx.request.body ?? {};
    const data = body.data ?? body;
    const patch: Record<string, unknown> = {};
    if (data.provider !== undefined) patch.provider = data.provider;
    if (data.baseUrl !== undefined) patch.baseUrl = data.baseUrl || null;
    if (data.model !== undefined) patch.model = data.model || null;
    if (data.apiKey !== undefined) {
      patch.apiKeyEncrypted = data.apiKey ? encrypt(String(data.apiKey)) : null;
    }

    // Use the low-level db.query API — for plugin-internal singletons this
    // sidesteps the v5 Documents API's draft/publish workflow, which can make
    // findFirst() return null even right after a successful create.
    try {
      const q = strapi.db.query('plugin::forms.ai-provider-config' as any);
      const existing = await q.findOne({});
      if (existing) {
        await q.update({ where: { id: existing.id }, data: patch });
      } else {
        await q.create({ data: patch });
      }
    } catch (err) {
      strapi.log.error('[forms] ai-provider-config save failed', err);
      ctx.status = 500;
      ctx.body = { error: { message: (err as Error).message } };
      return;
    }

    // Invalidate cached provider so the next request picks up the new config.
    strapi.plugin('forms').service('ai').invalidate();

    const config = await strapi.plugin('forms').service('ai').describe();
    ctx.body = { data: config };
  },
});

export default controller;

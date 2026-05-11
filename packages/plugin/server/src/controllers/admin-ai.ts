import { errors } from '@strapi/utils';
import type { Core } from '@strapi/strapi';
import { encrypt } from '../utils/encryption';

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

    // Bypass Koa's default response handling so we can write incrementally.
    ctx.respond = false;
    const res = ctx.res;
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering if any
    res.flushHeaders?.();

    const send = (payload: Record<string, unknown>) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    let aborted = false;
    ctx.req.on('close', () => {
      aborted = true;
    });

    try {
      const result = await strapi
        .plugin('forms')
        .service('ai')
        .stream({
          target,
          mode,
          prompt,
          currentSchema: body.currentSchema,
          currentTheme: body.currentTheme,
          onChunk: (text: string) => {
            if (!aborted) send({ type: 'chunk', text });
          },
        });
      if (!aborted) {
        if (result.target === 'style') {
          send({ type: 'done', target: 'style', theme: result.theme });
        } else {
          send({ type: 'done', target: 'layout', schema: result.schema });
        }
      }
    } catch (err) {
      if (!aborted) send({ type: 'error', error: (err as Error).message });
    } finally {
      res.end();
    }
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

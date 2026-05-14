/**
 * Plugin service that owns the active AiProvider instance. Picks the
 * implementation at first use based on (a) env-var overrides (production
 * preference) or (b) the ai-provider-config single type (admin-configured).
 *
 * Strapi service signature: factory function called with `{ strapi }`.
 */
import type { Core } from '@strapi/strapi';
import { NoneProvider } from './none';
import { MockProvider } from './mock';
import type { AiProvider, AiProviderConfig, CollectionDescriptor, FieldTypeDescriptor } from './types';
import { decrypt } from '../../utils/encryption';

const resolveConfig = async (strapi: Core.Strapi): Promise<AiProviderConfig> => {
  const envProvider = process.env.STRAPI_FORMS_AI_PROVIDER;
  const envKey = process.env.STRAPI_FORMS_AI_API_KEY;
  const envBase = process.env.STRAPI_FORMS_AI_BASE_URL;
  const envModel = process.env.STRAPI_FORMS_AI_MODEL;

  // Env vars win when set — for production where teams keep secrets out of DB.
  if (envProvider) {
    return {
      provider: envProvider as AiProviderConfig['provider'],
      apiKey: envKey,
      baseUrl: envBase,
      model: envModel,
    };
  }

  // Otherwise read the ai-provider-config single type via low-level db.query
  // — paired with the writer in controllers/admin-ai.ts. Avoids the v5
  // Documents API draft/publish quirks for plugin-internal singletons.
  try {
    const stored = (await strapi.db
      .query('plugin::forms.ai-provider-config' as any)
      .findOne({})) as any;
    if (!stored) return { provider: 'none' };
    const apiKey = stored.apiKeyEncrypted ? safeDecrypt(stored.apiKeyEncrypted) : undefined;
    return {
      provider: (stored.provider as AiProviderConfig['provider']) ?? 'none',
      apiKey,
      baseUrl: stored.baseUrl ?? undefined,
      model: stored.model ?? undefined,
    };
  } catch (err) {
    strapi.log.warn('[forms] ai-provider-config read failed', err);
    return { provider: 'none' };
  }
};

const safeDecrypt = (ciphertext: string): string | undefined => {
  try {
    return decrypt(ciphertext);
  } catch {
    return undefined;
  }
};

const buildProvider = async (
  strapi: Core.Strapi,
  config: AiProviderConfig
): Promise<AiProvider> => {
  switch (config.provider) {
    case 'mock':
      return new MockProvider();
    case 'anthropic': {
      const { AnthropicProvider } = await import('./anthropic');
      return new AnthropicProvider(config);
    }
    case 'openai': {
      const { OpenAIProvider } = await import('./openai');
      return new OpenAIProvider(config);
    }
    case 'ollama': {
      // Ollama uses the same OpenAI-compatible code path with a different baseURL.
      const { OpenAIProvider } = await import('./openai');
      return new OpenAIProvider({
        ...config,
        baseUrl: config.baseUrl ?? 'http://localhost:11434/v1',
        apiKey: config.apiKey ?? 'ollama', // Ollama ignores it but the SDK requires one
        model: config.model ?? 'llama3',
      });
    }
    case 'none':
    default:
      return new NoneProvider();
  }
};

const service = ({ strapi }: { strapi: Core.Strapi } = { strapi: undefined as any }) => {
  const $strapi: Core.Strapi = strapi ?? (globalThis as any).strapi;
  let cached: { config: AiProviderConfig; provider: AiProvider } | null = null;

  const ensure = async (): Promise<AiProvider> => {
    const config = await resolveConfig($strapi);
    if (
      cached &&
      cached.config.provider === config.provider &&
      cached.config.apiKey === config.apiKey &&
      cached.config.baseUrl === config.baseUrl &&
      cached.config.model === config.model
    ) {
      return cached.provider;
    }
    const provider = await buildProvider($strapi, config);
    cached = { config, provider };
    return provider;
  };

  const fieldTypeDescriptors = (): FieldTypeDescriptor[] => {
    const registry = $strapi.plugin('forms').service('fieldRegistry');
    return (registry.list() as Array<{ name: string; aiHint: string }>).map((f) => ({
      name: f.name,
      aiHint: f.aiHint,
    }));
  };

  // Enumerate api::* and plugin::* collection types the AI may reference via
  // `optionsSource`. Same filter as admin-forms.contentTypes so the AI's
  // mental model matches the picker UI.
  const collectionDescriptors = (): CollectionDescriptor[] => {
    const out: CollectionDescriptor[] = [];
    for (const [uid, ct] of Object.entries($strapi.contentTypes as Record<string, any>)) {
      if (!uid.startsWith('api::') && !uid.startsWith('plugin::')) continue;
      if (ct.kind !== 'collectionType') continue;
      if (uid.startsWith('plugin::forms.') || uid.startsWith('plugin::upload.')) continue;
      const stringAttributes = Object.entries(ct.attributes ?? {})
        .filter(([, attr]: [string, any]) =>
          ['string', 'text', 'uid', 'email'].includes(attr?.type)
        )
        .map(([name]) => name);
      out.push({
        uid,
        displayName: ct.info?.displayName ?? ct.info?.singularName ?? uid,
        stringAttributes,
      });
    }
    out.sort((a, b) => a.displayName.localeCompare(b.displayName));
    return out;
  };

  return {
    async generate(prompt: string) {
      const provider = await ensure();
      return provider.generateForm({
        prompt,
        availableFieldTypes: fieldTypeDescriptors(),
        availableCollections: collectionDescriptors(),
      });
    },

    async refine(instruction: string, currentSchema: any) {
      const provider = await ensure();
      return provider.refineForm({
        instruction,
        currentSchema,
        availableFieldTypes: fieldTypeDescriptors(),
        availableCollections: collectionDescriptors(),
      });
    },

    /**
     * Streaming variant. The controller wraps this in an SSE response so
     * the admin panel can render tokens live. `target` picks the pipeline:
     * 'layout' (FormSchema) or 'style' (ThemeConfig overrides).
     */
    async stream(args: {
      target: 'layout' | 'style';
      mode: 'generate' | 'refine';
      prompt: string;
      currentSchema?: any;
      currentTheme?: Record<string, unknown>;
      onChunk: (text: string) => void;
    }) {
      const provider = await ensure();
      if (args.target === 'style') {
        const theme = await provider.streamStyle({
          prompt: args.prompt,
          currentTheme: args.currentTheme,
          onChunk: args.onChunk,
        });
        return { target: 'style' as const, theme };
      }
      const schema = await provider.streamForm({
        mode: args.mode,
        prompt: args.prompt,
        currentSchema: args.currentSchema,
        availableFieldTypes: fieldTypeDescriptors(),
        availableCollections: collectionDescriptors(),
        onChunk: args.onChunk,
      });
      return { target: 'layout' as const, schema };
    },

    async healthCheck() {
      const provider = await ensure();
      return provider.healthCheck();
    },

    /**
     * Invalidate the cached provider — call after the admin updates the
     * ai-provider-config so the next request picks up the new key.
     */
    invalidate() {
      cached = null;
    },

    /** Used by the settings page so it doesn't reveal the stored key. */
    async describe() {
      const config = await resolveConfig($strapi);
      return {
        provider: config.provider,
        baseUrl: config.baseUrl,
        model: config.model,
        apiKeyConfigured: Boolean(config.apiKey),
        envOverridden: Boolean(process.env.STRAPI_FORMS_AI_PROVIDER),
      };
    },
  };
};

export default service;

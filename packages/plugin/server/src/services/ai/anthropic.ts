/**
 * Anthropic provider: uses the @anthropic-ai/sdk to call Claude.
 * SDK-bridging only — the parse+retry loop lives in ./retry.ts.
 *
 * Model defaults to claude-haiku-4-5 (fast, cheap, good enough for form
 * generation). Overridable via `model` in config or STRAPI_FORMS_AI_MODEL.
 */
import Anthropic from '@anthropic-ai/sdk';
import { type FormSchema } from '../../schemas/form-schema';
import { buildRefinePrompt, buildStyleSystemPrompt, buildSystemPrompt } from './prompts';
import { tryParseSchema, tryParseStyle } from './parse';
import { runWithRetries, type ConversationMessage } from './retry';
import type { AiProvider, AiProviderConfig, FieldTypeDescriptor } from './types';

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
const ID = 'anthropic';

export class AnthropicProvider implements AiProvider {
  readonly id = ID;
  private client: Anthropic;
  private model: string;

  constructor(config: AiProviderConfig) {
    if (!config.apiKey) throw new Error('Anthropic provider requires an API key.');
    this.client = new Anthropic({ apiKey: config.apiKey, baseURL: config.baseUrl });
    this.model = config.model ?? DEFAULT_MODEL;
  }

  // Non-streaming wrapper around the same retry loop — the invoker just
  // doesn't forward deltas (messages.create is one-shot).
  private callOnce =
    (system: string, maxTokens: number) =>
    async ({ conversation, onDelta }: { conversation: ConversationMessage[]; onDelta: (s: string) => void }) => {
      // Anthropic's `system` is a top-level param; user/assistant messages go in `messages`.
      const messages = conversation.filter((m) => m.role !== 'system') as Array<{
        role: 'user' | 'assistant';
        content: string;
      }>;
      const res = await this.client.messages.create({
        model: this.model,
        max_tokens: maxTokens,
        system,
        messages,
      });
      return res.content
        .filter((b) => b.type === 'text')
        .map((b: any) => b.text)
        .join('\n')
        .trim();
    };

  // Streaming wrapper: same retry loop, but the invoker forwards token
  // deltas via onDelta as they arrive.
  private streamOnce =
    (system: string, maxTokens: number) =>
    async ({ conversation, onDelta }: { conversation: ConversationMessage[]; onDelta: (s: string) => void }) => {
      const messages = conversation.filter((m) => m.role !== 'system') as Array<{
        role: 'user' | 'assistant';
        content: string;
      }>;
      let buffered = '';
      const stream = this.client.messages.stream({
        model: this.model,
        max_tokens: maxTokens,
        system,
        messages,
      });
      stream.on('text', (delta: string) => {
        buffered += delta;
        onDelta(delta);
      });
      await stream.finalMessage();
      return buffered;
    };

  async generateForm(args: {
    prompt: string;
    availableFieldTypes: FieldTypeDescriptor[];
  }): Promise<FormSchema> {
    const system = buildSystemPrompt(args.availableFieldTypes);
    return runWithRetries({
      providerLabel: ID,
      baseMessages: [{ role: 'user', content: args.prompt }],
      invoke: this.callOnce(system, 4096),
      parse: (raw) => {
        const r = tryParseSchema(raw);
        return r.ok ? { ok: true, value: r.schema } : r;
      },
    });
  }

  async refineForm(args: {
    instruction: string;
    currentSchema: FormSchema;
    availableFieldTypes: FieldTypeDescriptor[];
  }): Promise<FormSchema> {
    const system = buildSystemPrompt(args.availableFieldTypes);
    return runWithRetries({
      providerLabel: ID,
      baseMessages: [
        { role: 'user', content: buildRefinePrompt(args.currentSchema) },
        { role: 'assistant', content: 'Ready.' },
        { role: 'user', content: args.instruction },
      ],
      invoke: this.callOnce(system, 4096),
      parse: (raw) => {
        const r = tryParseSchema(raw);
        return r.ok ? { ok: true, value: r.schema } : r;
      },
    });
  }

  async streamForm(args: {
    mode: 'generate' | 'refine';
    prompt: string;
    currentSchema?: FormSchema;
    availableFieldTypes: FieldTypeDescriptor[];
    onChunk: (text: string) => void;
  }): Promise<FormSchema> {
    const system = buildSystemPrompt(args.availableFieldTypes);
    const baseMessages: ConversationMessage[] = [];
    if (args.mode === 'refine' && args.currentSchema) {
      baseMessages.push({ role: 'user', content: buildRefinePrompt(args.currentSchema) });
      baseMessages.push({ role: 'assistant', content: 'Ready.' });
    }
    baseMessages.push({ role: 'user', content: args.prompt });

    return runWithRetries({
      providerLabel: ID,
      baseMessages,
      invoke: this.streamOnce(system, 4096),
      parse: (raw) => {
        const r = tryParseSchema(raw);
        return r.ok ? { ok: true, value: r.schema } : r;
      },
      onChunk: args.onChunk,
    });
  }

  async streamStyle(args: {
    prompt: string;
    currentTheme?: Record<string, unknown>;
    onChunk: (text: string) => void;
  }): Promise<Record<string, unknown>> {
    const system = buildStyleSystemPrompt(args.currentTheme);
    return runWithRetries({
      providerLabel: ID,
      baseMessages: [{ role: 'user', content: args.prompt }],
      invoke: this.streamOnce(system, 2048),
      parse: (raw) => {
        const r = tryParseStyle(raw);
        return r.ok ? { ok: true, value: r.theme } : r;
      },
      onChunk: args.onChunk,
    });
  }

  async healthCheck(): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.client.messages.create({
        model: this.model,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }
}

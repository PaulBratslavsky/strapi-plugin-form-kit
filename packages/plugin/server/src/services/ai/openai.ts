/**
 * OpenAI-compatible provider. Used for both OpenAI's API and Ollama's
 * OpenAI-compatible endpoint — just point baseURL at the local server.
 * SDK-bridging only — the parse+retry loop lives in ./retry.ts.
 */
import OpenAI from 'openai';
import { type FormSchema } from '../../schemas/form-schema';
import { buildRefinePrompt, buildStyleSystemPrompt, buildSystemPrompt } from './prompts';
import { tryParseSchema, tryParseStyle } from './parse';
import { runWithRetries, type ConversationMessage } from './retry';
import type { AiProvider, AiProviderConfig, FieldTypeDescriptor } from './types';

const DEFAULT_MODEL = 'gpt-4o-mini';

export class OpenAIProvider implements AiProvider {
  readonly id: string;
  private client: OpenAI;
  private model: string;

  constructor(config: AiProviderConfig) {
    if (!config.apiKey) {
      throw new Error('OpenAI-compatible provider requires an API key (or sentinel for Ollama).');
    }
    this.client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseUrl });
    this.model = config.model ?? DEFAULT_MODEL;
    this.id = config.baseUrl?.includes('11434') ? 'ollama' : 'openai';
  }

  private callOnce =
    (system: string) =>
    async ({ conversation }: { conversation: ConversationMessage[]; onDelta: (s: string) => void }) => {
      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: system },
        ...conversation,
      ];
      const res = await this.client.chat.completions.create({
        model: this.model,
        response_format: { type: 'json_object' } as any,
        messages,
      });
      return res.choices[0]?.message?.content?.trim() ?? '';
    };

  private streamOnce =
    (system: string) =>
    async ({ conversation, onDelta }: { conversation: ConversationMessage[]; onDelta: (s: string) => void }) => {
      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: system },
        ...conversation,
      ];
      const stream = await this.client.chat.completions.create({
        model: this.model,
        response_format: { type: 'json_object' } as any,
        messages,
        stream: true,
      });
      let buffered = '';
      for await (const chunk of stream as any) {
        const delta: string = chunk?.choices?.[0]?.delta?.content ?? '';
        if (delta) {
          buffered += delta;
          onDelta(delta);
        }
      }
      return buffered;
    };

  async generateForm(args: {
    prompt: string;
    availableFieldTypes: FieldTypeDescriptor[];
  }): Promise<FormSchema> {
    const system = buildSystemPrompt(args.availableFieldTypes);
    return runWithRetries({
      providerLabel: this.id,
      baseMessages: [{ role: 'user', content: args.prompt }],
      invoke: this.callOnce(system),
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
      providerLabel: this.id,
      baseMessages: [
        { role: 'user', content: buildRefinePrompt(args.currentSchema) },
        { role: 'assistant', content: 'Ready.' },
        { role: 'user', content: args.instruction },
      ],
      invoke: this.callOnce(system),
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
      providerLabel: this.id,
      baseMessages,
      invoke: this.streamOnce(system),
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
      providerLabel: this.id,
      baseMessages: [{ role: 'user', content: args.prompt }],
      invoke: this.streamOnce(system),
      parse: (raw) => {
        const r = tryParseStyle(raw);
        return r.ok ? { ok: true, value: r.theme } : r;
      },
      onChunk: args.onChunk,
    });
  }

  async healthCheck() {
    try {
      await this.client.chat.completions.create({
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

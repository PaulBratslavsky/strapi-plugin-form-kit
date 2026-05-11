/**
 * OpenAI-compatible provider. Used for both OpenAI's API and Ollama's
 * OpenAI-compatible endpoint (just point baseURL at the local server).
 * Same shape as the Anthropic provider but uses chat.completions + JSON mode.
 */
import OpenAI from 'openai';
import { type FormSchema } from '../../schemas/form-schema';
import { buildRefinePrompt, buildStyleSystemPrompt, buildSystemPrompt } from './prompts';
import { tryParseSchema, tryParseStyle } from './parse';
import type { AiProvider, AiProviderConfig, FieldTypeDescriptor } from './types';

const DEFAULT_MODEL = 'gpt-4o-mini';
const MAX_RETRIES = 2;

type ChatMsg = { role: 'system' | 'user' | 'assistant'; content: string };

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

  async generateForm(args: {
    prompt: string;
    availableFieldTypes: FieldTypeDescriptor[];
  }): Promise<FormSchema> {
    return this.runWithRetries(args.availableFieldTypes, [{ role: 'user', content: args.prompt }]);
  }

  async refineForm(args: {
    instruction: string;
    currentSchema: FormSchema;
    availableFieldTypes: FieldTypeDescriptor[];
  }): Promise<FormSchema> {
    return this.runWithRetries(args.availableFieldTypes, [
      { role: 'user', content: buildRefinePrompt(args.currentSchema) },
      { role: 'assistant', content: 'Ready.' },
      { role: 'user', content: args.instruction },
    ]);
  }

  async streamForm(args: {
    mode: 'generate' | 'refine';
    prompt: string;
    currentSchema?: FormSchema;
    availableFieldTypes: FieldTypeDescriptor[];
    onChunk: (text: string) => void;
  }): Promise<FormSchema> {
    const system = buildSystemPrompt(args.availableFieldTypes);
    const messages: ChatMsg[] = [{ role: 'system', content: system }];
    if (args.mode === 'refine' && args.currentSchema) {
      messages.push({ role: 'user', content: buildRefinePrompt(args.currentSchema) });
      messages.push({ role: 'assistant', content: 'Ready.' });
    }
    messages.push({ role: 'user', content: args.prompt });

    let lastError: string | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const convo = [...messages];
      if (lastError) {
        convo.push({
          role: 'user',
          content: `Your previous response was invalid: ${lastError}\nReturn ONLY the JSON object.`,
        });
      }

      const stream = await this.client.chat.completions.create({
        model: this.model,
        response_format: { type: 'json_object' } as any,
        messages: convo,
        stream: true,
      });

      let buffered = '';
      for await (const chunk of stream as any) {
        const delta: string = chunk?.choices?.[0]?.delta?.content ?? '';
        if (delta) {
          buffered += delta;
          args.onChunk(delta);
        }
      }

      const parsed = tryParseSchema(buffered);
      if (parsed.ok) return parsed.schema;
      lastError = parsed.error;
    }

    throw new Error(
      `OpenAI-compatible provider produced invalid output after ${MAX_RETRIES + 1} attempts: ${lastError}`
    );
  }

  async streamStyle(args: {
    prompt: string;
    currentTheme?: Record<string, unknown>;
    onChunk: (text: string) => void;
  }): Promise<Record<string, unknown>> {
    const system = buildStyleSystemPrompt(args.currentTheme);
    let lastError: string | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const convo: ChatMsg[] = [
        { role: 'system', content: system },
        { role: 'user', content: args.prompt },
      ];
      if (lastError) {
        convo.push({
          role: 'user',
          content: `Your previous response was invalid: ${lastError}\nReturn ONLY the JSON object.`,
        });
      }

      const stream = await this.client.chat.completions.create({
        model: this.model,
        response_format: { type: 'json_object' } as any,
        messages: convo,
        stream: true,
      });

      let buffered = '';
      for await (const chunk of stream as any) {
        const delta: string = chunk?.choices?.[0]?.delta?.content ?? '';
        if (delta) {
          buffered += delta;
          args.onChunk(delta);
        }
      }

      const parsed = tryParseStyle(buffered);
      if (parsed.ok) return parsed.theme;
      lastError = parsed.error;
    }
    throw new Error(
      `OpenAI-compatible provider produced invalid style after ${MAX_RETRIES + 1} attempts: ${lastError}`
    );
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

  private async runWithRetries(
    fieldTypes: FieldTypeDescriptor[],
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<FormSchema> {
    const system = buildSystemPrompt(fieldTypes);
    let lastError: string | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const conversation: any[] = [{ role: 'system', content: system }, ...messages];
      if (lastError) {
        conversation.push({
          role: 'user',
          content: `Your previous response was invalid: ${lastError}\nReturn ONLY the JSON object.`,
        });
      }

      const res = await this.client.chat.completions.create({
        model: this.model,
        response_format: { type: 'json_object' } as any,
        messages: conversation,
      });

      const text = res.choices[0]?.message?.content?.trim() ?? '';
      const parseResult = tryParseSchema(text);
      if (parseResult.ok) return parseResult.schema;
      lastError = parseResult.error;
    }

    throw new Error(
      `OpenAI-compatible provider produced invalid output after ${MAX_RETRIES + 1} attempts: ${lastError}`
    );
  }
}

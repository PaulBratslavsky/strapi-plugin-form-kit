/**
 * Anthropic provider: uses the @anthropic-ai/sdk to call Claude with
 * messages.create / messages.stream. Auto-retries on parse failure up to
 * MAX_RETRIES.
 *
 * Model defaults to claude-haiku-4-5 (fast, cheap, good enough for form
 * generation). Overridable via `model` in config or STRAPI_FORMS_AI_MODEL.
 */
import Anthropic from '@anthropic-ai/sdk';
import { type FormSchema } from '../../schemas/form-schema';
import { buildRefinePrompt, buildStyleSystemPrompt, buildSystemPrompt } from './prompts';
import { tryParseSchema, tryParseStyle } from './parse';
import type { AiProvider, AiProviderConfig, FieldTypeDescriptor } from './types';

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
const MAX_RETRIES = 2;

type ConvoMsg = { role: 'user' | 'assistant'; content: string };

export class AnthropicProvider implements AiProvider {
  readonly id = 'anthropic';
  private client: Anthropic;
  private model: string;

  constructor(config: AiProviderConfig) {
    if (!config.apiKey) {
      throw new Error('Anthropic provider requires an API key.');
    }
    this.client = new Anthropic({ apiKey: config.apiKey, baseURL: config.baseUrl });
    this.model = config.model ?? DEFAULT_MODEL;
  }

  async generateForm(args: {
    prompt: string;
    availableFieldTypes: FieldTypeDescriptor[];
  }): Promise<FormSchema> {
    return this.runWithRetries(args.availableFieldTypes, [
      { role: 'user', content: args.prompt },
    ]);
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
    const messages: ConvoMsg[] = [];
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

      let buffered = '';
      const stream = this.client.messages.stream({
        model: this.model,
        max_tokens: 4096,
        system,
        messages: convo,
      });

      stream.on('text', (delta: string) => {
        buffered += delta;
        args.onChunk(delta);
      });

      await stream.finalMessage();

      const parsed = tryParseSchema(buffered);
      if (parsed.ok) return parsed.schema;
      lastError = parsed.error;
    }

    throw new Error(
      `Anthropic produced invalid output after ${MAX_RETRIES + 1} attempts: ${lastError}`
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
      const convo: ConvoMsg[] = [{ role: 'user', content: args.prompt }];
      if (lastError) {
        convo.push({
          role: 'user',
          content: `Your previous response was invalid: ${lastError}\nReturn ONLY the JSON object, nothing else.`,
        });
      }

      let buffered = '';
      const stream = this.client.messages.stream({
        model: this.model,
        max_tokens: 2048,
        system,
        messages: convo,
      });
      stream.on('text', (delta: string) => {
        buffered += delta;
        args.onChunk(delta);
      });
      await stream.finalMessage();

      const parsed = tryParseStyle(buffered);
      if (parsed.ok) return parsed.theme;
      lastError = parsed.error;
    }
    throw new Error(
      `Anthropic produced invalid style after ${MAX_RETRIES + 1} attempts: ${lastError}`
    );
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

  private async runWithRetries(
    fieldTypes: FieldTypeDescriptor[],
    messages: ConvoMsg[]
  ): Promise<FormSchema> {
    const system = buildSystemPrompt(fieldTypes);
    let lastError: string | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const conversation = [...messages];
      if (lastError) {
        conversation.push({
          role: 'user',
          content: `Your previous response was invalid: ${lastError}\nReturn ONLY the JSON object, nothing else.`,
        });
      }

      const res = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        system,
        messages: conversation,
      });

      const text = res.content
        .filter((block) => block.type === 'text')
        .map((block: any) => block.text)
        .join('\n')
        .trim();

      const parseResult = tryParseSchema(text);
      if (parseResult.ok) return parseResult.schema;
      lastError = parseResult.error;
    }

    throw new Error(
      `Anthropic produced invalid output after ${MAX_RETRIES + 1} attempts: ${lastError}`
    );
  }
}

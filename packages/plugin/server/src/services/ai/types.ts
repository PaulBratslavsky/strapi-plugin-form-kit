/**
 * The contract every AI provider implementation must satisfy. The submit
 * endpoint, settings page, and AiBuilderPanel all talk to providers through
 * this interface so we can swap implementations (Anthropic / OpenAI / Ollama
 * / Mock / None) without ripple effects.
 */
import type { FormSchema } from '../../schemas/form-schema';

export type FieldTypeDescriptor = {
  name: string;
  aiHint: string;
};

export interface AiProvider {
  readonly id: string;
  /**
   * Generate a complete FormSchema from a natural-language prompt.
   * Implementations are expected to validate output against the canonical
   * schema and retry up to 2x on invalid JSON before throwing.
   */
  generateForm(args: {
    prompt: string;
    availableFieldTypes: FieldTypeDescriptor[];
  }): Promise<FormSchema>;

  /**
   * Refine an existing FormSchema based on a natural-language instruction.
   * Examples: "add a phone field", "make the company field optional".
   */
  refineForm(args: {
    instruction: string;
    currentSchema: FormSchema;
    availableFieldTypes: FieldTypeDescriptor[];
  }): Promise<FormSchema>;

  /**
   * Streaming variant for layout (form-schema) generation/refinement.
   * Token stream reported via onChunk; promise resolves with parsed
   * canonical FormSchema.
   */
  streamForm(args: {
    mode: 'generate' | 'refine';
    prompt: string;
    currentSchema?: FormSchema;
    availableFieldTypes: FieldTypeDescriptor[];
    onChunk: (text: string) => void;
  }): Promise<FormSchema>;

  /**
   * Streaming variant for style. Same shape but emits a partial
   * ThemeConfig (overrides). Caller merges over current theme.
   */
  streamStyle(args: {
    prompt: string;
    currentTheme?: Record<string, unknown>;
    onChunk: (text: string) => void;
  }): Promise<Record<string, unknown>>;

  /**
   * Quick reachability check. Should not perform a real generation —
   * a single tiny request, just enough to confirm credentials + endpoint.
   */
  healthCheck(): Promise<{ ok: boolean; error?: string }>;
}

/**
 * The shape held by the ai-provider-config single type plus env-var overrides.
 */
export type AiProviderConfig = {
  provider: 'none' | 'anthropic' | 'openai' | 'ollama' | 'mock';
  apiKey?: string;
  baseUrl?: string;
  model?: string;
};

/**
 * Why we keep providerId on the result: lets the AiBuilderPanel show
 * which model produced a generation (helpful for debugging "the AI got it
 * wrong" reports).
 */
export type GenerationMeta = {
  providerId: string;
  retries: number;
};

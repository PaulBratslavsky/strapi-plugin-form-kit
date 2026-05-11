/**
 * Provider-agnostic parse-and-retry loop. Each provider supplies a
 * one-shot invocation (call the SDK, return the raw text; optionally
 * stream deltas via `onDelta`) and a parser; this helper owns the
 * retry logic + error-feedback message format.
 *
 * Lifted out of the per-provider classes because it was duplicated
 * four times (anthropic.streamForm, anthropic.streamStyle,
 * openai.streamForm, openai.streamStyle) plus twice more for the
 * non-streaming paths. A bug in one would have to be patched in six.
 */

export type ConversationMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type GenericParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export type InvokeOnce = (args: {
  conversation: ConversationMessage[];
  onDelta: (text: string) => void;
}) => Promise<string>;

export type RunArgs<T> = {
  /** Provider identifier, used only in the final "produced invalid output" error message. */
  providerLabel: string;
  /** The user/assistant messages that don't change across retries. The
   *  system prompt is the invoker's responsibility (Anthropic puts it in
   *  a separate `system` field; OpenAI prepends a `role: 'system'` msg). */
  baseMessages: ConversationMessage[];
  /** Calls the LLM once; receives the conversation built by this helper. */
  invoke: InvokeOnce;
  /** Validates and parses the model's raw output. */
  parse: (raw: string) => GenericParseResult<T>;
  /** Token-by-token deltas. Caller can omit for non-streaming. */
  onChunk?: (text: string) => void;
  maxRetries?: number;
};

const DEFAULT_MAX_RETRIES = 2;

const feedbackMessage = (error: string): ConversationMessage => ({
  role: 'user',
  content: `Your previous response was invalid: ${error}\nReturn ONLY the JSON object.`,
});

export const runWithRetries = async <T>({
  providerLabel,
  baseMessages,
  invoke,
  parse,
  onChunk,
  maxRetries = DEFAULT_MAX_RETRIES,
}: RunArgs<T>): Promise<T> => {
  let lastError: string | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const conversation: ConversationMessage[] = [...baseMessages];
    if (lastError) conversation.push(feedbackMessage(lastError));

    const raw = await invoke({
      conversation,
      onDelta: onChunk ?? noop,
    });

    const result = parse(raw);
    if (result.ok) return result.value;
    lastError = result.error;
  }

  throw new Error(
    `${providerLabel} produced invalid output after ${maxRetries + 1} attempts: ${lastError}`
  );
};

const noop = () => {};

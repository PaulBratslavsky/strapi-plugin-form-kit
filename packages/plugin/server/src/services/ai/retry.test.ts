/**
 * retry.ts is the parse-and-retry loop shared by every provider. A bug
 * here would affect Anthropic, OpenAI, and Ollama at once, so it earns
 * direct coverage independent of any real SDK.
 */
import { describe, it, expect, vi } from 'vitest';
import { runWithRetries, type GenericParseResult } from './retry';

const okParse = (raw: string): GenericParseResult<{ raw: string }> => ({
  ok: true,
  value: { raw },
});

describe('runWithRetries', () => {
  it('returns the parsed value on first success without retrying', async () => {
    const invoke = vi.fn(async () => 'good');
    const parse = vi.fn(okParse);

    const result = await runWithRetries({
      providerLabel: 'test',
      baseMessages: [{ role: 'user', content: 'hi' }],
      invoke,
      parse,
    });

    expect(result).toEqual({ raw: 'good' });
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(parse).toHaveBeenCalledTimes(1);
  });

  it('retries with an error-feedback message and succeeds on a later attempt', async () => {
    let call = 0;
    const invoke = vi.fn(async ({ conversation }) => {
      call += 1;
      // Record what the helper passed so we can assert the feedback message.
      return call < 3 ? 'bad' : `good:${conversation.length}`;
    });
    const parse = vi.fn(
      (raw: string): GenericParseResult<string> =>
        raw.startsWith('good')
          ? { ok: true, value: raw }
          : { ok: false, error: 'nope' }
    );

    const result = await runWithRetries({
      providerLabel: 'test',
      baseMessages: [{ role: 'user', content: 'hi' }],
      invoke,
      parse,
    });

    // 3rd attempt succeeded. The helper rebuilds [base] + ONE latest-error
    // feedback message each retry (it doesn't accumulate feedback — keeps
    // the conversation bounded), so the final call's conversation is
    // [base, feedback] → length 2.
    expect(result).toBe('good:2');
    expect(invoke).toHaveBeenCalledTimes(3);
  });

  it('appends a feedback message containing the prior parse error', async () => {
    const seen: string[] = [];
    const invoke = vi.fn(async ({ conversation }) => {
      seen.push(conversation.map((m) => m.content).join(' | '));
      return 'still bad';
    });
    const parse = (): GenericParseResult<never> => ({
      ok: false,
      error: 'specific-error-text',
    });

    await expect(
      runWithRetries({
        providerLabel: 'test',
        baseMessages: [{ role: 'user', content: 'base' }],
        invoke,
        parse,
        maxRetries: 1,
      })
    ).rejects.toThrow();

    // Second attempt's conversation should carry the feedback message.
    expect(seen[1]).toContain('specific-error-text');
  });

  it('throws after maxRetries with provider label and last error', async () => {
    const invoke = vi.fn(async () => 'garbage');
    const parse = (): GenericParseResult<never> => ({ ok: false, error: 'bad json' });

    await expect(
      runWithRetries({
        providerLabel: 'ollama',
        baseMessages: [{ role: 'user', content: 'x' }],
        invoke,
        parse,
        maxRetries: 2,
      })
    ).rejects.toThrow(/ollama produced invalid output after 3 attempts: bad json/);

    // maxRetries=2 → 3 total attempts (initial + 2 retries).
    expect(invoke).toHaveBeenCalledTimes(3);
  });

  it('forwards onChunk to the invoker as onDelta', async () => {
    const chunks: string[] = [];
    const invoke = vi.fn(async ({ onDelta }) => {
      onDelta('a');
      onDelta('b');
      return 'ab';
    });

    await runWithRetries({
      providerLabel: 'test',
      baseMessages: [],
      invoke,
      parse: okParse,
      onChunk: (t) => chunks.push(t),
    });

    expect(chunks).toEqual(['a', 'b']);
  });

  it('uses a no-op onDelta when onChunk is omitted (non-streaming path)', async () => {
    const invoke = vi.fn(async ({ onDelta }) => {
      // Should not throw even though no onChunk was supplied.
      onDelta('ignored');
      return 'ok';
    });

    await expect(
      runWithRetries({
        providerLabel: 'test',
        baseMessages: [],
        invoke,
        parse: okParse,
      })
    ).resolves.toEqual({ raw: 'ok' });
  });
});

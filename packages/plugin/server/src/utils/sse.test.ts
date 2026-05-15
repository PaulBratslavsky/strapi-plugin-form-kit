/**
 * sse.ts owns the SSE wire protocol for streaming controllers. A fake
 * Koa ctx lets us assert headers, framing, abort handling, and the
 * error-to-event conversion without a running server.
 */
import { describe, it, expect, vi } from 'vitest';
import { streamSSE } from './sse';

type WriteLog = string[];

const makeCtx = () => {
  const headers: Record<string, string> = {};
  const writes: WriteLog = [];
  let ended = false;
  const closeListeners: Array<() => void> = [];

  const ctx: any = {
    respond: true,
    res: {
      statusCode: 0,
      setHeader: (k: string, v: string) => {
        headers[k] = v;
      },
      flushHeaders: vi.fn(),
      write: (chunk: string) => {
        writes.push(chunk);
      },
      end: () => {
        ended = true;
      },
    },
    req: {
      on: (event: string, cb: () => void) => {
        if (event === 'close') closeListeners.push(cb);
      },
    },
  };

  return {
    ctx,
    headers,
    writes,
    isEnded: () => ended,
    fireClose: () => closeListeners.forEach((cb) => cb()),
  };
};

describe('streamSSE', () => {
  it('sets the SSE headers and disables Koa response handling', async () => {
    const { ctx, headers } = makeCtx();
    await streamSSE(ctx, async () => {});

    expect(ctx.respond).toBe(false);
    expect(ctx.res.statusCode).toBe(200);
    expect(headers['Content-Type']).toBe('text/event-stream');
    expect(headers['Cache-Control']).toMatch(/no-cache/);
    expect(headers['Connection']).toBe('keep-alive');
    expect(headers['X-Accel-Buffering']).toBe('no');
  });

  it('frames each emit as a `data: <json>\\n\\n` line', async () => {
    const { ctx, writes } = makeCtx();
    await streamSSE(ctx, async (emit) => {
      emit({ type: 'chunk', text: 'hello' });
      emit({ type: 'done', schema: { ok: 1 } } as any);
    });

    expect(writes).toEqual([
      `data: ${JSON.stringify({ type: 'chunk', text: 'hello' })}\n\n`,
      `data: ${JSON.stringify({ type: 'done', schema: { ok: 1 } })}\n\n`,
    ]);
  });

  it('ends the response exactly once after the handler resolves', async () => {
    const { ctx, isEnded } = makeCtx();
    await streamSSE(ctx, async (emit) => emit({ type: 'chunk', text: 'x' }));
    expect(isEnded()).toBe(true);
  });

  it('converts a thrown error into a final error event and still ends', async () => {
    const { ctx, writes, isEnded } = makeCtx();
    await streamSSE(ctx, async () => {
      throw new Error('boom');
    });

    expect(writes.at(-1)).toBe(
      `data: ${JSON.stringify({ type: 'error', error: 'boom' })}\n\n`
    );
    expect(isEnded()).toBe(true);
  });

  it('stops writing once the client closes the connection', async () => {
    const { ctx, writes, fireClose } = makeCtx();
    await streamSSE(ctx, async (emit, signal) => {
      emit({ type: 'chunk', text: 'first' });
      fireClose(); // simulate client disconnect
      expect(signal.aborted).toBe(true);
      emit({ type: 'chunk', text: 'should-be-suppressed' });
    });

    expect(writes).toEqual([
      `data: ${JSON.stringify({ type: 'chunk', text: 'first' })}\n\n`,
    ]);
  });
});

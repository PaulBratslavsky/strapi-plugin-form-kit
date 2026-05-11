/**
 * Server-Sent Events helper for Strapi (Koa) controllers.
 *
 * Owns the wire-protocol detail (Content-Type, Cache-Control, framing,
 * abort handling, `res.end()`) so controllers express only the business
 * payload: emit a chunk, emit a done, emit an error. The same pattern
 * showed up once in admin-ai.ts#stream; any second streaming endpoint
 * (webhook preview, AI thinking trace, …) would otherwise duplicate it.
 */

/**
 * The wire event shape. Add cases here when a new streaming endpoint
 * needs more than chunk/done/error. The discriminated union is the
 * actual interface to the protocol.
 */
export type SSEEvent =
  | { type: 'chunk'; text: string }
  | { type: 'done'; [k: string]: unknown }
  | { type: 'error'; error: string };

export type Emit = (event: SSEEvent) => void;

export type StreamSignal = { aborted: boolean };

export type SSEHandler = (emit: Emit, signal: StreamSignal) => Promise<void>;

/**
 * Wrap a Strapi controller body in an SSE response. The handler can call
 * `emit` any number of times. If it throws, the error is converted to a
 * final `{ type: 'error' }` event and the response is closed cleanly.
 *
 * Usage:
 *   await streamSSE(ctx, async (emit, signal) => {
 *     await service.stream({
 *       onChunk: (text) => !signal.aborted && emit({ type: 'chunk', text }),
 *     });
 *     emit({ type: 'done', schema });
 *   });
 */
export const streamSSE = async (ctx: any, handler: SSEHandler): Promise<void> => {
  // Bypass Koa's default response handling so we can write incrementally.
  ctx.respond = false;
  const res = ctx.res;
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  // Disable buffering on reverse proxies (nginx, etc.) that would otherwise
  // hold the response until it's "big enough" to flush.
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const signal: StreamSignal = { aborted: false };
  ctx.req.on('close', () => {
    signal.aborted = true;
  });

  const emit: Emit = (event) => {
    if (signal.aborted) return;
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  try {
    await handler(emit, signal);
  } catch (err) {
    emit({ type: 'error', error: (err as Error).message });
  } finally {
    res.end();
  }
};

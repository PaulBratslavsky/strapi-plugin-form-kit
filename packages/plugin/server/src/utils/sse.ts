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
You are a senior frontend engineer. Generate a production-quality form component for the following Strapi Forms schema.

## Form metadata
- Name: my-form
- Slug: my-form
- Public schema URL: GET /api/forms/my-form/schema
- Public submit URL: POST /api/forms/my-form/submit

## Canonical schema (the contract)
```json
{
  "schemaVersion": 1,
  "fields": [
    {
      "id": "f5a0c2b1-dac5-4fbd-9d59-370ee85d2cac",
      "label": "Title",
      "validations": [
        {
          "kind": "required",
          "message": "Title is required."
        }
      ],
      "type": "text"
    },
    {
      "id": "ddbb9601-e94f-4b1d-824a-615465faf2d3",
      "label": "Severity",
      "helpText": "How critical is this bug?",
      "validations": [
        {
          "kind": "required",
          "message": "Severity is required."
        }
      ],
      "type": "dropdown",
      "options": [
        {
          "label": "Critical",
          "value": "critical"
        },
        {
          "label": "High",
          "value": "high"
        },
        {
          "label": "Medium",
          "value": "medium"
        },
        {
          "label": "Low",
          "value": "low"
        }
      ]
    },
    {
      "id": "56cb3148-aa33-4ff5-bb8b-2f733d762d2b",
      "label": "Steps to Reproduce",
      "helpText": "Provide clear, ordered steps so developers can follow them.",
      "placeholder": "List the exact steps taken to see the bug (e.g., 1. Navigate to X, 2. Click Y, 3. Observe Z).",
      "validations": [
        {
          "kind": "required",
          "message": "Steps to Reproduce is required."
        }
      ],
      "type": "textarea",
      "rows": 4
    },
    {
      "id": "6f16b47f-0d9e-4ba0-9584-f4273b8fd68a",
      "label": "Actual Behavior",
      "helpText": "Describe what actually happened when you performed the steps.",
      "validations": [],
      "type": "textarea",
      "rows": 4
    },
    {
      "id": "360b39c3-8e8e-43cf-9d6c-6ab92f353da0",
      "label": "Expected Behavior",
      "helpText": "Describe what should have happened.",
      "validations": [],
      "type": "textarea",
      "rows": 4
    }
  ],
  "settings": {
    "submitButtonLabel": "Submit",
    "successMessage": "Thank you for your submission.",
    "errorMessage": "Something went wrong. Please try again.",
    "honeypotEnabled": true,
    "authenticatedOnly": false,
    "theme": {
      "preset": "clean",
      "primaryColor": "#4949ff",
      "backgroundColor": "#ffffff",
      "textColor": "#000000"
    }
  }
}
```

## What to generate
Produce a single self-contained component (in the framework I'm using — ask if unsure) that:
1. Renders a label + appropriate input for each field in `schema.fields`, in the order given.
2. Honors each field's `type`, `placeholder`, `helpText`, `validations`, and type-specific properties (`options`, `rows`, `step`, `min`, `max`).
3. Validates client-side: respects `required`, `minLength`, `maxLength`, `min`, `max`, `pattern`, `email`, `url` rules — and shows error messages from the rule's `message` if present.
4. On submit, POSTs JSON to the submit URL with body `{ "data": { "<fieldId>": <value>, ... }, "honeypot": "" }`.
5. Honors `settings.submitButtonLabel`, `settings.successMessage`, `settings.errorMessage`, and `settings.redirectUrl`.
6. If `settings.honeypotEnabled` is true, includes a hidden `honeypot` input that real users won't fill.
7. Surfaces server validation errors (HTTP 400 with body `{ errors: { "<fieldId>": ["msg"] } }`) under the matching field.
8. Uses the project's design system / utility classes for styling. Otherwise, plain semantic HTML.

Use `field.id` (UUID) as the form name attribute and as the key in the submitted `data` object — never the label, since labels can change.

If the framework or styling system is unclear, ask before generating.
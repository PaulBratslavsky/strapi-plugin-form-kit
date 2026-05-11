# Webhooks

Configure outbound HTTP webhooks per-form. On submission, the plugin fires the webhook (with retries on failure) and records every attempt to a delivery log.

## Two dispatch modes

| Mode | When | Durability |
|---|---|---|
| **BullMQ** | `STRAPI_FORMS_REDIS_URL` is set | Pending retries survive Strapi restarts |
| **Inline** (default) | `STRAPI_FORMS_REDIS_URL` is unset | `setTimeout`-based retries; lost on restart (warned at boot) |

The interface is identical; the rest of the codebase doesn't know which is active.

For production, **set `STRAPI_FORMS_REDIS_URL`**. Inline mode is fine for development.

## Configure a webhook

Form → **Webhooks** → **Add webhook**.

| Field | Notes |
|---|---|
| Name | Internal label |
| URL | Must be `http://` or `https://` |
| Method | `POST` (default) or `PUT` |
| HMAC secret | Optional. When set, requests carry a `X-Strapi-Forms-Signature: sha256=<hex>` header |
| Enabled | Quick on/off |

The HMAC secret is encrypted at rest using AES-256-GCM with a key derived from `APP_KEYS[0]` (see [permissions.md](permissions.md) for key rotation guidance).

## Payload

```json
{
  "formId": "<documentId>",
  "formSlug": "contact",
  "submissionId": "<documentId>",
  "data": { "<fieldId>": <value>, ... },
  "submittedAt": "2026-01-15T18:23:01.000Z"
}
```

## HMAC signature

```
X-Strapi-Forms-Signature: sha256=<hex(hmac(secret, body))>
```

Verify on the receiving side:

```js
const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
const ok = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(receivedHeader));
```

## Retry policy

- Retries on transient failures: HTTP 408, 429, 5xx, and network errors.
- 4xx other than 408/429 are considered permanent failures (no retry).
- Exponential backoff: 1s, 2s, 4s, 8s, 16s, capped at 60s.
- Maximum attempts: `STRAPI_FORMS_WEBHOOK_RETRY_MAX` (default 5).

## Delivery log

Every attempt — success, failed, or error — is written to `strapi_forms_webhook_delivery_log`. View recent entries by clicking **Recent deliveries** on a webhook.

The log captures: webhook config id, submission id, attempt number, status, HTTP status, response body preview (first 1KB), error message, duration.

## Tips

- Test with [webhook.site](https://webhook.site/) to inspect deliveries before pointing at your real receiver.
- Inline mode prints a warning at boot — that's intentional. Configure Redis for production.
- BullMQ workers run in the same Strapi process by default. For high-volume sites, split them out using BullMQ's worker-only mode.

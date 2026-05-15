# strapi-plugin-form-kit

A native **Strapi v5** plugin for building, embedding, and managing forms —
drag-and-drop builder, AI-assisted creation, submissions inbox, email
notifications, webhooks, and a self-hosted embed runtime.

[![npm](https://img.shields.io/npm/v/strapi-plugin-form-kit.svg)](https://www.npmjs.com/package/strapi-plugin-form-kit)
[![license](https://img.shields.io/npm/l/strapi-plugin-form-kit.svg)](./LICENSE)

---

## What you get

- **Drag-and-drop form builder** in the Strapi admin — 12 core field types, plus a registry so host projects can add their own.
- **AI form builder** — describe a form in plain English; Claude / GPT / local Ollama drafts it. Bring your own key, encrypted at rest. Streaming UI with live field cards.
- **Style mode** — visual theming per form (4 presets, per-field overrides, "I'm feeling lucky" random vibe picker, AI-driven styling). The admin preview renders the *actual* embed runtime, so it's pixel-identical to production.
- **Collection-backed dropdowns** — point a dropdown / radio / checkboxes field at any Strapi collection; options resolve server-side at request time. No public read access required.
- **Submissions inbox** — filters, search, bulk actions, per-status counts, CSV export.
- **Email notifications** — Liquid templates, per-form rules, delivery audit log.
- **Webhooks** — HMAC signing, retries (BullMQ when Redis is set; inline fallback otherwise), delivery log.
- **Three deploy shapes** — script tag, iframe, or shareable hosted link. All served by the plugin itself; no separate package or CDN.
- **Headless API** — `GET /api/forms/:slug/schema` + `POST /api/forms/:slug/submit` for custom renderers.
- **Per-IP rate limiting** on the public submit endpoint.

---

## Installation

```bash
npm install strapi-plugin-form-kit
# or
yarn add strapi-plugin-form-kit
# or
pnpm add strapi-plugin-form-kit
```

Enable it in `config/plugins.ts` (or `.js`):

```ts
export default ({ env }) => ({
  forms: {
    enabled: true,
    config: {
      // All optional:
      redisUrl: env('STRAPI_FORMS_REDIS_URL'),          // BullMQ webhook dispatcher; inline fallback if unset
      webhookRetryMax: env.int('STRAPI_FORMS_WEBHOOK_RETRY_MAX', 5),
      submitRateLimit: {                                 // public submit endpoint
        enabled: true,
        windowMs: 60_000,
        max: 10,
      },
    },
  },
});
```

Restart Strapi. **"Forms"** appears in the admin sidebar. The embed runtime
ships inside this package and is served at `/api/forms/embed.js` — no second
install, no CDN.

> Requires **Strapi v5**. Node ≥ 20.

---

## Quick start

### 1. Build a form

1. Sidebar → **Forms** → **Create new form**. Name it; the slug becomes the public URL.
2. Drag fields from the palette **or** click **AI** in the toolbar and describe the form.
3. Click a field to edit label, help text, validations, type-specific options.
4. Switch to **Style** mode to theme it. Click **I'm feeling lucky** or use the AI drawer ("make it dark", "newspapery").
5. **Save & publish.**

### 2. Embed it

Click **Share** in the form toolbar. Three options:

```html
<!-- Script — recommended. Auto-detects this Strapi instance. -->
<div data-strapi-form="contact"></div>
<script src="https://your-cms.com/api/forms/embed.js"></script>

<!-- Iframe — full CSS isolation, no-code friendly -->
<iframe src="https://your-cms.com/api/forms/contact/embed"
        style="border:0;width:100%;min-height:600px"></iframe>

<!-- Direct link — shareable URL with OG meta tags -->
https://your-cms.com/api/forms/contact/embed
```

Script and iframe snippets target the form's stable `documentId` underneath,
so renaming the slug won't break embeds already pasted on other sites.

### 3. Or go headless

```bash
# Fetch the form definition
curl https://your-cms.com/api/forms/contact/schema

# Submit
curl -X POST https://your-cms.com/api/forms/contact/submit \
  -H "Content-Type: application/json" \
  -d '{"data":{"<fieldId>":"<value>"},"honeypot":""}'
```

Render it however you like. The schema endpoint sends `Cache-Control:
no-cache` + a strong ETag, so republished forms reflect on the next page
load with no manual cache busting.

---

## AI form builder (optional)

Settings cog → **Forms** → **AI builder**. Pick a provider:

| Provider | Notes |
|---|---|
| **Anthropic (Claude)** | Recommended for quality. `claude-haiku-4-5` default. |
| **OpenAI (GPT)** | `gpt-4o-mini` default. |
| **Ollama** | Fully local, no API key. Point base URL at `http://localhost:11434/v1`. |
| **Mock** | Keyword stub for tests / offline dev. |

API keys are encrypted at rest (AES-256-GCM). For production, set env vars
instead — they override the UI and become read-only there:

```bash
STRAPI_FORMS_AI_PROVIDER=anthropic
STRAPI_FORMS_AI_API_KEY=sk-ant-...
STRAPI_FORMS_AI_MODEL=claude-haiku-4-5-20251001
STRAPI_FORMS_AI_BASE_URL=                 # optional (Ollama / gateways)
```

The AI also knows about your collections — prompt *"event picker from our
Events collection"* and it generates a collection-backed dropdown.

---

## Collection-backed options

For `dropdown` / `radio` / `checkboxes` fields, toggle **"From collection"**
in the field config:

1. Pick a Strapi collection (e.g. `api::product.product`).
2. Choose the **label field** (what users see) and **value field** (what's submitted; defaults to `documentId`).

Options resolve server-side at `/schema` read time. **You do not need to
grant public read access** to the collection — the resolver runs as an
internal service call. Only published entries are included. Max 200 rows.

---

## Configuration reference

| Env var | Default | Purpose |
|---|---|---|
| `STRAPI_FORMS_REDIS_URL` | _(unset)_ | When set, BullMQ webhook dispatcher; unset = inline retry |
| `STRAPI_FORMS_WEBHOOK_RETRY_MAX` | `5` | Max webhook delivery retries |
| `STRAPI_FORMS_WEBHOOK_HMAC_DEFAULT_SECRET` | _(unset)_ | Default HMAC secret if a webhook config has none |
| `STRAPI_FORMS_AI_PROVIDER` | _(unset)_ | `anthropic` / `openai` / `ollama` / `mock` / `none` — overrides admin UI |
| `STRAPI_FORMS_AI_API_KEY` | _(unset)_ | Provider API key |
| `STRAPI_FORMS_AI_MODEL` | _(per-provider)_ | Model override |
| `STRAPI_FORMS_AI_BASE_URL` | _(per-provider)_ | API base URL (Ollama / self-hosted gateways) |
| `STRAPI_FORMS_RATELIMIT_ENABLED` | `true` | Toggle submit rate limiting |
| `STRAPI_FORMS_RATELIMIT_WINDOW_MS` | `60000` | Rate-limit window |
| `STRAPI_FORMS_RATELIMIT_MAX` | `10` | Max submits per window per (IP, slug) |

---

## Public API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/forms/:slug/schema` | Canonical form schema (incl. theme, resolved options) |
| `POST` | `/api/forms/:slug/submit` | Submit. Body: `{ data: { fieldId: value }, honeypot: "" }` |
| `GET` | `/api/forms/embed.js` | The embed runtime bundle |
| `GET` | `/api/forms/:slug/embed` | Standalone HTML page (iframe / direct link) |

`:slug` accepts a slug **or** a `documentId`.

---

## Extending: custom field types

Host projects can register field types that show up in the builder palette,
the AI's vocabulary, and the embed renderer. Two-sided registration mirrors
Strapi's `customFields.register()`:

```ts
// server
strapi.plugin('forms').service('fieldRegistry').register({
  name: 'rating',
  storageType: 'number',
  aiHint: 'A 1–5 star rating.',
  configSchema: z.object({ max: z.number().default(5) }),
});
```

See the full recipe in [`docs/custom-field-types.md`](https://github.com/PaulBratslavsky/strapi-plugin-form-kit/blob/main/docs/custom-field-types.md).

---

## Documentation

**[Browse the full documentation →](https://github.com/PaulBratslavsky/strapi-plugin-form-kit/blob/main/docs/README.md)**

- [Getting started](https://github.com/PaulBratslavsky/strapi-plugin-form-kit/blob/main/docs/getting-started.md)
- [AI builder](https://github.com/PaulBratslavsky/strapi-plugin-form-kit/blob/main/docs/ai-builder.md)
- [Embed snippet](https://github.com/PaulBratslavsky/strapi-plugin-form-kit/blob/main/docs/embed-snippet.md)
- [Form schema reference](https://github.com/PaulBratslavsky/strapi-plugin-form-kit/blob/main/docs/form-schema.md)
- [Custom field types](https://github.com/PaulBratslavsky/strapi-plugin-form-kit/blob/main/docs/custom-field-types.md)
- [Notifications](https://github.com/PaulBratslavsky/strapi-plugin-form-kit/blob/main/docs/notifications.md)
- [Webhooks](https://github.com/PaulBratslavsky/strapi-plugin-form-kit/blob/main/docs/webhooks.md)
- [Permissions](https://github.com/PaulBratslavsky/strapi-plugin-form-kit/blob/main/docs/permissions.md)

---

## Privacy

The plugin never sends form data anywhere except your own Strapi instance.
The AI is only called when you explicitly invoke it, and only sees the
prompts you type — never submission data. API keys are encrypted at rest.

---

## License

MIT © Paul Bratslavsky. See [LICENSE](./LICENSE).

Changelog: [CHANGELOG.md](./CHANGELOG.md).

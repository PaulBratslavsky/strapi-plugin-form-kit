# Getting started

This guide takes you from a clean Strapi v5 project to a working contact form embedded on a static HTML page in under 15 minutes.

## 1. Install

```bash
npm install strapi-plugin-forms
```

The embed runtime ships **inside the plugin** — you don't need a separate npm package for the script. In `config/plugins.ts` (or `.js`), enable the plugin:

```ts
export default ({ env }) => ({
  forms: {
    enabled: true,
    config: {
      // Optional — when set, BullMQ is used for webhook delivery. Without
      // it the plugin falls back to inline retry.
      redisUrl: env('STRAPI_FORMS_REDIS_URL'),
      webhookRetryMax: env.int('STRAPI_FORMS_WEBHOOK_RETRY_MAX', 5),
    },
  },
});
```

Then `npm run develop`. The Forms plugin appears in the left sidebar of the Strapi admin.

## 2. (Optional) Configure the AI form builder

If you want to draft and refine forms in plain English:

1. Settings cog → **Forms** → **AI builder**.
2. Pick a provider: **Anthropic** / **OpenAI** / **Ollama** (local, no API key) / **Mock** (keyword-based, no API call).
3. Paste your API key — encrypted at rest. Click **Test connection**.

For production where you don't want admin users to manage the key, set env vars instead — they override the UI:

```bash
STRAPI_FORMS_AI_PROVIDER=anthropic
STRAPI_FORMS_AI_API_KEY=sk-ant-...
STRAPI_FORMS_AI_MODEL=claude-haiku-4-5-20251001
```

Full details: [ai-builder.md](ai-builder.md).

## 3. Build a form

1. Open **Forms** → **Create new form**.
2. Give it a name and slug (the slug becomes the public URL: `/api/forms/<slug>/embed` and `/schema`).
3. Drag fields from the left palette **or** click the **AI** button in the toolbar to draft fields by description.
4. Click each field to edit its label, help text, required toggle, and type-specific options.
5. Switch to **Style** mode to tweak the visual theme. Click **I'm feeling lucky** to roll a random vibe, or open the AI drawer again — in Style mode it generates themes from prose ("make it dark", "more friendly", "newspapery").
6. Click **Save & publish**.

## 4. Test the public endpoint

```bash
curl http://localhost:1337/api/forms/<slug>/schema
```

Returns the canonical form schema (incl. theme + settings). Submit with:

```bash
curl -X POST http://localhost:1337/api/forms/<slug>/submit \
  -H "Content-Type: application/json" \
  -d '{"data":{"<fieldId>":"<value>"}}'
```

The response includes the configured success message and the submission's `documentId`.

## 5. Embed the form on any page

Open any form, click **Share** in the toolbar. Three flavours, copy the one you need:

### Script — recommended for most sites

```html
<div data-strapi-form="<slug-or-id>"></div>
<script src="https://your-cms.com/api/forms/embed.js"></script>
```

The bundle is served by the plugin itself at `/api/forms/embed.js`. It auto-detects the Strapi origin from its own script URL, so you don't need a `data-strapi-base-url` attribute. Multiple forms per page are fine — the runtime renders into every `[data-strapi-form]` on `DOMContentLoaded`.

### Iframe — for no-code sites or CSS isolation

```html
<iframe src="https://your-cms.com/api/forms/<slug>/embed"
        style="border:0;width:100%;min-height:600px"
        title="Contact form"></iframe>
```

The plugin serves a complete HTML page at `/api/forms/:slug/embed`. Best for Webflow/WordPress/Notion where you can't paste arbitrary script tags, and for total isolation from host-page styles.

### Direct link — shareable URL

```
https://your-cms.com/api/forms/<slug>/embed
```

Same hosted page. Includes OG/Twitter meta tags so it renders nicely in Slack, email, social.

**Headless option**: skip the embed entirely and render however you want. Just fetch `/schema` for the form definition and `POST /submit` your data. See [embed-snippet.md](embed-snippet.md) for the full programmatic API.

## 6. Updating forms

Edit a published form in the admin → **Save & publish**. Every page with the embed sees the new version on the next load — the schema endpoint sends `Cache-Control: no-cache, must-revalidate` with a strong ETag, so changes propagate immediately. No deploy, no rebuild, no cache bust.

If you rename a slug, the **Script** and **Iframe** snippets use the form's stable `documentId` underneath, so existing embeds keep working. Direct links use the slug (human-readable URL) and will need to be updated.

## 7. Next steps

- **Email notifications** when a submission arrives — see [notifications.md](notifications.md).
- **Webhooks** to forward submissions to other services — see [webhooks.md](webhooks.md).
- **Custom field types** — register your own renderers from a host project; see [custom-field-types.md](custom-field-types.md).
- **Permissions** + client handoff recipe — see [permissions.md](permissions.md).
- **AI form builder** — full setup, model recommendations, troubleshooting; see [ai-builder.md](ai-builder.md).

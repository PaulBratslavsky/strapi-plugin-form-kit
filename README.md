# Strapi Forms

A native Strapi v5 plugin that lets marketing and content teams build, embed, and manage forms — from drag-and-drop creation to submission review to integrations — without leaving the Strapi admin.

> **Status: in active development.** Phase 1 (free MVP) and Phase 2 (AI builder, M10–M11) shipped. See `resources/06-claude-code-spec.md` for the roadmap.

## What's in this monorepo

| Path | Purpose |
|---|---|
| `packages/plugin/` | The Strapi v5 plugin (`strapi-plugin-form-kit`) — contains everything end users install |
| `packages/embed/` | The embed runtime source (`@strapi-forms/embed`). Its IIFE bundle is copied into the plugin's `dist/embed/` at build time and served at `/api/forms/embed.js`. Exists as a separate workspace mostly for code organisation. Publish to npm separately only if you want users to bundler-import it; not required for normal use. |
| `test-app/` | A Strapi v5 sandbox project that links the plugin for local development |
| `examples/embed-demo/` | A small Vite frontend that renders any published form locally — useful for sanity-checking the embed against a real Strapi instance |
| `docs/` | User-facing documentation |
| `resources/` | The product spec and engineering blueprint |

**Deploy story (one command).** End users only install the plugin:

```bash
npm install strapi-plugin-form-kit
```

The embed runtime ships inside the plugin's npm tarball — no separate package to install, no CDN to configure. See "Production install" below.

## What you get

- **Drag-and-drop form builder** in the Strapi admin (12 core field types, plus a registry for custom types)
- **AI form builder** — describe a form in English; Claude / GPT / local Ollama drafts it. BYOK, encrypted at rest. Streaming UI with live field cards.
- **Style mode** — visual customisation per form (4 themes, per-field overrides, "I'm feeling lucky" random vibe picker, AI-driven styling)
- **Submissions inbox** with filters, search, bulk actions, CSV export
- **Email notifications** with Liquid templates and per-form rules
- **Webhooks** with HMAC signing, retries (BullMQ when Redis is set; inline fallback otherwise) and a delivery audit log
- **Three deploy shapes** for embedding a built form on any site (more in `docs/embed-snippet.md`):
  ```html
  <!-- Script (recommended) — auto-detects this Strapi instance -->
  <div data-strapi-form="contact"></div>
  <script src="https://your-cms.com/api/forms/embed.js"></script>

  <!-- Iframe — full CSS isolation, no-code-friendly -->
  <iframe src="https://your-cms.com/api/forms/contact/embed"></iframe>

  <!-- Direct link — share by URL, includes OG meta tags -->
  https://your-cms.com/api/forms/contact/embed
  ```
- **Headless API** stays usable for custom renderers — `GET /api/forms/:slug/schema` returns the form definition; `POST /api/forms/:slug/submit` accepts submissions.

The script and iframe snippets target the form's stable `documentId` underneath, so renaming the slug won't break embeds on third-party sites. The direct-link URL uses the slug (since it's human-readable) and would change on rename.

## Production install

```bash
npm install strapi-plugin-form-kit
```

Add to `config/plugins.ts`:

```ts
export default ({ env }) => ({
  forms: { enabled: true },
});
```

Restart Strapi. That's it — the embed runtime is bundled inside the plugin and served by your own Strapi instance at `/api/forms/embed.js`. No separate npm package, no CDN dependency, no second deploy.

End users editing forms in the admin **never trigger a build**: the schema endpoint sends `Cache-Control: no-cache, must-revalidate` with an ETag, so republished forms are reflected on the next page load against every embed on the web. Only plugin version upgrades require a redeploy.

## Quick start (development)

```bash
./scripts/setup.sh        # first time: install, rebuild native deps, build packages, run tests
./scripts/start.sh        # boot the test-app at http://localhost:1337/admin
```

For ongoing plugin development, use the watcher mode:

```bash
./scripts/start.sh --watch    # rebuilds packages/plugin on every save
```

To rebuild the publishable packages (plugin + embed) without running anything:

```bash
./scripts/build.sh                # both packages
./scripts/build.sh --clean        # remove dist/ first
./scripts/build.sh --plugin       # only the Strapi plugin
./scripts/build.sh --embed        # only the embed snippet
./scripts/build.sh --typecheck    # tsc --noEmit on every package
```

Other useful flags:

```bash
./scripts/setup.sh --no-test  # skip the test step
./scripts/start.sh --reset    # drop the SQLite DB and start fresh
./scripts/start.sh --prod     # run `strapi start` instead of `strapi develop`
```

If you'd rather run the underlying commands directly:

```bash
pnpm install
pnpm --filter strapi-plugin-form-kit build
pnpm --filter test-app develop
```

## Stack

- **Strapi**: v5 only
- **Schema**: Zod (canonical form schema, runtime validation, type inference)
- **Admin UI**: Strapi Design System
- **Drag-and-drop**: `@dnd-kit/core` + `@dnd-kit/sortable`
- **Webhook delivery**: BullMQ + Redis when configured; inline retry fallback otherwise
- **Embed snippet**: vanilla TS + Vite (ESM + IIFE bundles)
- **Testing**: Vitest

## Environment variables (plugin)

Defined in `test-app/config/plugins.ts` and respected at plugin bootstrap.

| Variable | Default | Purpose |
|---|---|---|
| `STRAPI_FORMS_REDIS_URL` | _(unset)_ | When set, BullMQ webhook dispatcher is used. Unset = inline retry fallback. |
| `STRAPI_FORMS_WEBHOOK_RETRY_MAX` | `5` | Maximum retry attempts for webhook delivery |
| `STRAPI_FORMS_WEBHOOK_HMAC_DEFAULT_SECRET` | _(unset)_ | Default HMAC secret if a webhook config has none set |
| `STRAPI_FORMS_AI_PROVIDER` | _(unset)_ | `anthropic` / `openai` / `ollama` / `mock` / `none`. Overrides the admin-UI config when set. |
| `STRAPI_FORMS_AI_API_KEY` | _(unset)_ | API key for the chosen provider (encrypted at rest if set via the admin UI instead) |
| `STRAPI_FORMS_AI_MODEL` | _(per-provider default)_ | Override the model (e.g. `claude-haiku-4-5-20251001`, `gpt-4o-mini`, `llama3`) |
| `STRAPI_FORMS_AI_BASE_URL` | _(per-provider default)_ | Override the API base URL — useful for Ollama (`http://localhost:11434/v1`) or self-hosted gateways |

When any `STRAPI_FORMS_AI_*` is set, the admin AI settings page becomes read-only and shows a banner indicating env-var overrides are active.

## Recommendations / next steps

What I'd prioritise if continuing this project, roughly in order:

1. **Publish to npm.** The plugin is currently local-only. `npm publish` makes `npm install strapi-plugin-form-kit` work for real Strapi projects. Pre-flight: confirm the `dist/` includes `dist/embed/embed.js` (it does — `pnpm run copy:embed` runs as part of `build`).

2. **Publish-time validation.** We relaxed `fields.min(1)` to allow empty drafts. Publish should enforce ≥ 1 field. One-liner gate in `controllers/admin-forms.ts#publish` or a lifecycle hook keyed on `publishedAt` change.

3. **AI test coverage.** The new harness (`services/ai/loose-schema.ts`, `normalize.ts`, `parse.ts`) has zero tests. Likely-bug spots: the type-alias table in `normalize.ts`, the buffer-carving regex in `parse.ts`. Three small test files (`normalize.test.ts`, `parse.test.ts`, `mock.test.ts`) cover ~80% of the surface.

4. **Rate-limit `/api/forms/:slug/submit`.** Public endpoint, no auth, can be hammered. Honeypot helps but isn't a real limit. Easiest path: a per-IP token bucket middleware on the public route (10/min default, env-overridable).

5. **Optional Turnstile / hCaptcha integration.** Forms with bot-prone audiences (signup, contact). Add a per-form setting + a tiny middleware that verifies the token before the submit handler runs.

6. **CSS hook docs for host pages.** `docs/embed-snippet.md` lists the class names but examples of "override the submit button colour from my site's CSS" would help.

7. **Submission inbox quality of life.** Bulk-delete with undo, search across field values (currently only metadata), CSV column ordering.

8. **History-preserving AI refines.** Right now the AI's `refineForm` wholesale-replaces the schema, blowing away undo history. A `REPLACE_SCHEMA` reducer action that pushes the current state to `past` would let Cmd+Z take you back to pre-AI state.

9. **Skills framework for the AI layer.** The Build/Style mode-aware split is a clean stop, but the next AI feature (validation suggestions, copy improver) would benefit from a real `AiSkill` interface with pluggable input schemas + transforms. See the proposal in `CLAUDE.md` under "What's in flight."

10. **CDN-served embed as an opt-in.** Self-hosted is the default and fine for most. But for sites with massive traffic or Strapi instances on small infra, allowing `<script src="https://cdn.jsdelivr.net/npm/strapi-plugin-form-kit-embed/...">` reduces bytes through Strapi. Implementation: a second build artefact published to npm; the share modal offers it as a 4th flavour.

11. **Observability hook in the embed runtime.** When a submission fails on the host page, the host site has no idea. Either a `window.dispatchEvent('strapi-forms:error', ...)` for host pages to listen to, or an optional `onError` reporter URL configured per-form.

12. **Editorial concerns**:
    - Recommend bumping the version to `0.2.0` once published — the embed deploy story is a breaking-shape change for anyone using the old `data-strapi-base-url` pattern (still works, but no longer required).
    - The legacy `default` preset alias should be migrated out of saved forms eventually — keep the alias forever, but a one-shot migration that rewrites stored themes prevents surprises during major upgrades.

## Documentation

- `docs/getting-started.md` — install + first form
- `docs/form-schema.md` — canonical Zod schema reference
- `docs/embed-snippet.md` — `<script>`-tag usage and CSS hooks
- `docs/custom-field-types.md` — registering new field types
- `docs/notifications.md` — email rules
- `docs/webhooks.md` — outgoing webhooks
- `docs/permissions.md` — roles + client handoff recipe
- `docs/ai-builder.md` — AI form generation (BYOK Anthropic / OpenAI / Ollama)
# strapi-plugin-form-kit

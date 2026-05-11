# CLAUDE.md — orientation for future sessions

Skim this before doing real work. The README, `docs/`, and `resources/` are
the authoritative product docs; this file captures the *load-bearing
knowledge* an AI agent needs to be productive without re-discovering it.

## What this is

A Strapi v5 plugin (`packages/plugin/strapi-plugin-form-builder`) for building and
embedding forms, plus a dependency-free embed snippet (`packages/embed/`).
The full product spec is in `resources/01-product.md` through
`resources/06-claude-code-spec.md` — read those for the *why*.

Phases that have shipped on `master`:
- **Phase 1 (M1–M9)**: free MVP — schema, builder, submissions, notifications,
  webhooks, embed.
- **Style builder**: Build/Style mode toggle, 4 themes (clean/editorial/
  friendly/bold), per-field overrides, footer drawer.
- **Phase 2 (M10–M11)**: AI form builder with BYOK providers (Anthropic,
  OpenAI, Ollama, Mock, None). Streaming via SSE. Loose-schema harness so
  small local models work reliably.

## Day-to-day commands

```bash
./scripts/start.sh            # boot test-app at http://localhost:1337/admin
./scripts/start.sh --watch    # plugin source watched + rebuilt on save
pnpm build                    # rebuild plugin from monorepo root
pnpm -F strapi-plugin-form-builder test    # unit tests for the plugin
```

The admin SPA hot-reloads on plugin source changes, but **server code does
not** — `strapi develop` watches `test-app/`, not workspace packages. To
force a server-side reload without killing the dev server:

```bash
touch test-app/config/server.ts
```

Wait ~3 sec, then `until curl -sf http://localhost:1337/_health; do
sleep 1; done`. This is the safe restart path used throughout development.

## Architecture quick reference

### Where things live in the plugin

```
packages/plugin/
├── server/src/
│   ├── content-types/         # form, submission, notification-rule, webhook-config,
│   │                          # ai-provider-config (singleton)
│   ├── controllers/           # admin-* and public
│   ├── services/
│   │   ├── ai/                # AI builder — see "AI subsystem" below
│   │   ├── field-registry.ts  # extension point for host projects
│   │   ├── form-schema-validator.ts   # strict Zod + per-field configSchema
│   │   ├── notification-dispatcher.ts
│   │   └── webhook-dispatcher/
│   ├── schemas/               # canonical Zod schemas (form-schema.ts is the source of truth)
│   ├── routes/admin.ts        # admin REST surface (with adminPolicy guard)
│   └── routes/index.ts        # public submit endpoint
├── admin/src/
│   ├── pages/                 # one file per route in the plugin SPA
│   ├── components/builder/    # the visual + style builder
│   ├── components/ai/         # AiBuilderPanel — chat surface, shared by FormBuilder drawer
│   ├── api.ts                 # all admin-API helpers (useFormsApi hook)
│   └── index.ts               # app.addMenuLink + app.createSettingSection
```

### Form schema is the spine

Everything serialises through `FormSchemaCore` in
`server/src/schemas/form-schema.ts`. The lifecycle hook in
`content-types/form/lifecycles.ts` runs the schema through
`form-schema-validator.ts` on every create/update. If you're changing the
shape of stored forms, that's the file to touch — both the Zod schema and
the registry-aware validator must agree.

`fields` is allowed to be empty so drafts can be saved blank. Publish-time
"at least one field" enforcement is a TODO when publish gets its own
validation pass.

### AI subsystem

The AI layer is built around two patterns worth understanding before
editing:

**1. The harness pattern.** Small local models can't reliably emit UUIDs or
strict discriminated unions, so the AI is asked for a *loose* shape (see
`services/ai/loose-schema.ts`) and code does the structuring:

```
raw model output
  → strip markdown fences + carve outermost {...}
  → JSON.parse
  → validate against LooseSchema (loose-schema.ts)
  → looseToFormSchema (normalize.ts) — adds UUIDs, builds validations,
    resolves type aliases, derives missing labels
  → validate against FormSchemaCore (sanity check; should rarely fail)
```

The whole pipeline lives in `services/ai/parse.ts` and is shared by every
provider. When a user reports "AI got it wrong", the layer to look at first
is `normalize.ts` — that's where most "wrong" can be made "right" without
re-prompting.

**2. Providers + streaming.** `AiProvider` (in `services/ai/types.ts`) has
`generateForm`, `refineForm`, `streamForm`, `healthCheck`. The streaming
endpoint (`POST /forms/admin/ai/stream`) is SSE — see
`controllers/admin-ai.ts` for the `ctx.respond = false` pattern. The client
side uses raw `fetch()` with `ReadableStream` (`admin/src/api.ts#aiStream`)
because `useFetchClient` wraps axios and can't expose `response.body`.

Provider implementations:
- `anthropic.ts`: `messages.stream()` event-based API.
- `openai.ts`: `chat.completions.create({stream: true})` — used for both
  OpenAI and Ollama (different `baseURL`, otherwise identical).
- `mock.ts`: deterministic keyword matcher; streams by chunking the final
  JSON in 8-char/30ms slices for dev.
- `none.ts`: every method throws "not configured" so the UI shows a clear
  setup prompt.

### Settings discovery

The AI builder settings page is registered via
`app.createSettingSection(...)` in `admin/src/index.ts` and lives at
`/admin/settings/forms/ai-builder` — the global cog menu, not inside the
plugin's own routes. There used to be a hand-rolled
`/plugins/forms/settings` route; it was deleted (`pages/SettingsPage.tsx`)
because the cog location is the idiomatic Strapi place.

## Strapi v5 footguns we've hit

- **Documents API for singletons is unreliable for plugin-internal data.**
  `documents.update({ documentId: undefined, data })` silently no-ops, and
  `findFirst()` can return null right after a successful `create()` due to
  draft/publish workflow even when `draftAndPublish: false` is set on the
  type. Use `strapi.db.query(uid).findOne/.update/.create` instead for
  plugin-owned singletons. See `controllers/admin-ai.ts#updateConfig`.

- **Admin JWT is in `localStorage.getItem('jwtToken')` (JSON-encoded)**,
  not cookies. `useFetchClient` injects it automatically. If you're calling
  a Strapi admin endpoint outside `useFetchClient` (e.g. for streaming),
  read it yourself — see `readAdminJwt` in `admin/src/api.ts`.

- **`strapi develop` doesn't watch workspace plugin source.** Plugin
  changes to `packages/plugin/server/src/**` need a manual restart trigger
  (touch a file in `test-app/config/`). The admin SPA *does* rebuild on
  plugin admin changes because the dev server serves admin chunks.

- **Submissions and D&P relations**: submissions are linked to the
  *published* form's int ID, but the admin queries the *draft* form. Filter
  by `form.documentId` (stable across versions), not numeric id. Already
  fixed in `admin-submissions`, `notification-dispatcher`,
  `webhook-dispatcher/{inline,bullmq}`. If you add a new code path that
  resolves submissions by form, do the same.

## Conventions

- **No comments explaining WHAT.** Well-named identifiers carry that. Only
  comment WHY when a constraint or workaround isn't obvious from the code.
- **No backwards-compat shims for code you're confident is unused.** Delete
  rather than rename-with-`_` prefix.
- **Error handling at boundaries only.** Don't wrap internal calls in
  try/catch unless you have something specific to do with the error.
- **Tests live next to source as `*.test.ts`**, run via vitest.
  Current coverage: `encryption`, `field-registry`, `form-schema-validator`,
  `notification-dispatcher`, `webhook-dispatcher/delivery`. **No AI tests
  yet** — `normalize`, `parse`, and the mock provider are obvious gaps.

## What's in flight

Open work the user has greenlit, in rough priority order:

1. **"I'm feeling lucky"** — Style mode button that applies one of ~8
   hand-curated theme vibes (espresso, brutalist, sunset, lab coat, 90s
   zine, pastel, neon arcade, editorial). Each vibe = a preset + a small
   set of CSS-var overrides. The vibes are also the vocabulary that the
   style-AI will pick from.

2. **Context-aware AI** — same Sparkle drawer, mode-aware system prompt:
   Build mode → layout AI (current behaviour), Style mode → style AI.
   Style AI emits a constrained shape — preset + overrides drawn from the
   vibe vocabulary above — and code applies. Never raw CSS. The mode is a
   *hint*, not a gate: cross-mode requests should still work.

3. **AI tests** — `normalize.test.ts` with ratty inputs, `parse.test.ts`
   with end-to-end raw-string → schema, `mock.test.ts` for the keyword
   matcher.

4. **Publish-time validation** — currently `fields` can be `[]` to allow
   blank drafts. Publish should enforce ≥1 field. Lives in
   `controllers/admin-forms.ts#publish` or a new lifecycle hook gated on
   `publishedAt` changing.

## Quick decision log

- Why streaming via SSE instead of WebSockets: SSE is one-way (server →
  client), one HTTP request, no extra protocol upgrade, and Koa makes
  raw-write trivial with `ctx.respond = false`.
- Why loose schema instead of forcing strict from the model: 8B local
  models can't reliably emit UUIDs or strict discriminated unions, and
  retry-on-failure was burning 3× the time for marginal quality gain.
  Loose schema + deterministic normaliser hits >95% first-try success on
  gemma4-kb.
- Why the AI drawer doesn't have a backdrop: the form canvas must stay
  interactive while AI is open — that's the whole point of moving from
  the centered Modal to a side drawer. Backdrop would defeat it.
- Why we didn't use OpenAI/Anthropic native tool-use yet: harness pattern
  works uniformly across all providers (including no-tool-use models like
  most Ollama models). Adding native tool-use for Anthropic/OpenAI is an
  optimisation for a follow-up.

## Don't

- Don't seed sample fields on form create. Empty canvas is the design.
- Don't add raw CSS generation to the AI. Constrained vocabulary only.
- Don't import `crypto.randomUUID()` in admin code without a polyfill check
  if you're targeting old browsers — Strapi's modern admin is fine but the
  embed snippet needs to stay light.
- Don't fight Strapi's `documents` API for plugin-internal singletons —
  drop to `strapi.db.query` (see footguns above).

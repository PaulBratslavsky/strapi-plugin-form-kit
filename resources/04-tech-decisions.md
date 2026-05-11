# Tech Decisions

Tech choices made to fit the requirements from Stage 3, not the other way around. The user had strong preferences and they win wherever they don't conflict with requirements. For each decision the **why** is captured so revisions are easier later.

## Strapi version
- **Choice**: Strapi v5 only
- **Considered**: v4 only, both v4 and v5
- **Why**: v5 is the current major version, has a modernized admin architecture with new hooks (`useFetchClient`, `useNotification`, `useAPIErrorHandler`), and is what new Strapi projects use. Supporting v4 doubles maintenance work for a bootstrapped team and slows v5 development. The Strapi v5 plugin ecosystem has clearly converged (e.g., the existing drag-and-drop plugins all standardized on v5 + dnd-kit). Going v5-only also simplifies admin component patterns and TypeScript story.

## Plugin scaffolding
- **Choice**: Strapi's official Plugin SDK (the standard `npx create-strapi-plugin` scaffolding)
- **Considered**: Custom structure
- **Why**: Standard scaffolding maximizes alignment with Strapi conventions, makes the plugin marketplace-ready by default, and ensures any Strapi developer can navigate the codebase without learning a custom layout. Marketplace-readiness matters because the success picture (Stage 1) is "blessed by or acquired by Strapi" — bucking conventions works against that goal.

## AI provider abstraction (BYOK chat builder)
- **Choice**: TanStack AI (currently alpha, v0.14.0 at time of writing) — wrapped in our own thin `AiProvider` interface
- **Considered**: Vercel AI SDK (mature, broader provider list), LangChain (way too heavy)
- **Why**: User has working prototype code with TanStack AI and values its strong TypeScript / Zod integration, which fits well with our schema-first principle (the AI must produce schemas that conform to a Zod definition — type-safe tool/function calling helps here). Risk: TanStack AI is alpha and APIs may shift. **Mitigation: a thin internal `AiProvider` interface** isolates the rest of the codebase from the SDK. Adapters: Anthropic Claude (default for cloud), OpenAI, and Ollama (for local LLMs like Gemma) cover the BYOK + local-LLM requirement from Stage 3.
- **What this looks like in practice**: Plugin code calls `aiProvider.generateFormSchema({ prompt, existingSchema, availableFieldTypes })`. Behind the interface, our adapter calls TanStack AI with a tool/function-call definition that constrains the output to a valid Zod-validated form schema.

## Schema definition format (canonical form schema)
- **Choice**: Zod
- **Considered**: JSON Schema + Ajv, TypeBox, Strapi's own schema format, custom DSL
- **Why**: TypeScript-first, strong runtime validation, AI-friendly (TanStack AI and the broader LLM tooling ecosystem have first-class Zod support for structured outputs), and produces TypeScript types directly from schemas via `z.infer`. The canonical form schema is the load-bearing artifact across the AI builder, the visual builder, the embed snippet, custom field types, and (eventually) the MCP server — Zod gives us one definition that serves all of them. The schema is published and documented as part of the plugin's public API contract.
- **Storage**: the actual form data is stored as a JSON column inside the `forms` Strapi content type; Zod is used at the application layer for validation and TypeScript type derivation.

## Visual builder UI library (admin panel)
- **Choice**: Strapi Design System (`@strapi/design-system`)
- **Considered**: shadcn/ui, custom components
- **Why**: The admin UI must look and feel native to Strapi — anything else makes the plugin feel third-party-bolted-on, which works against the success goal of being acquired/blessed by Strapi. Strapi devs already know the Design System patterns. Strapi v5 plugin tutorials and examples all use it. Using anything else creates friction for community contributors and makes the plugin look out-of-place.

## Drag-and-drop library
- **Choice**: `@dnd-kit/react` (the new v0.x package, not the legacy `@dnd-kit/core`)
- **Considered**: react-dnd, native HTML5 drag-and-drop
- **Why**: The Strapi v5 plugin ecosystem has standardized on dnd-kit — both existing v5 drag-drop plugins use it, including ones that explicitly migrated from react-dnd-era libraries. Built-in keyboard accessibility and screen reader support are essential for the admin (Stage 3 calls out accessibility as a free-tier requirement). Native multi-input (mouse, touch, keyboard) without backend swapping. Performance is the strongest in the category and Puck (a near-identical visual block builder) validates it for our exact use case. The "more setup" tradeoff is real but bounded — for a form builder we need maybe one provider, one sortable canvas, and a draggable palette.

## Embed snippet build
- **Choice**: Vanilla TypeScript + Vite, shipped as ESM and IIFE bundles
- **Considered**: Preact, Lit, Solid.js
- **Why**: Smallest possible bundle (~20KB target from Stage 3), no framework runtime, works on every host site (Webflow, plain HTML, any framework). Vite gives us modern tooling, fast builds, and dual-format output for free. The snippet's job is small and well-defined — render a form from a schema, validate, submit, expose stable CSS hooks and JS extension points — and doesn't benefit from a framework. Distributed as both an npm package (for build-step users) and a CDN-hosted IIFE (for `<script>` tag users).

## Database approach
- **Choice**: Hybrid — Strapi content types for user-facing entities, Knex-backed custom tables for high-volume delivery logs
- **Considered**: Pure Strapi content types for everything (Option 1), mostly custom tables (Option 3)
- **Why**: User-facing entities (Form, Submission, Notification rule, Webhook config) benefit from Strapi's content-type machinery — auto-generated REST/GraphQL APIs, lifecycle hooks, the entity service, native admin metadata, and database-agnostic migrations. Delivery logs (webhook delivery attempts, notification send attempts) are high-volume infrastructure data that the user doesn't browse — they benefit from raw Knex performance, proper compound indexes, fast bulk pruning, and not cluttering the admin UI.
- **Tradeoff being made**: small upfront complexity tax (two code paths, owning some Knex migrations directly) in exchange for a higher performance ceiling and a cleaner admin UI. Acceptable for a product where AI builder use likely drives high volume and webhook activity tends to compound.
- **Concrete split** (entities → storage):
  - `forms`, `submissions`, `notification_rules`, `webhook_configs` → Strapi content types
  - `webhook_delivery_log`, `notification_delivery_log` → Knex-backed custom tables, accessed via `strapi.db.connection`

## Email / notifications
- **Choice**: Strapi's existing email plugin / provider config
- **Considered**: Wrapping Strapi's email behind our own interface, rolling our own
- **Why**: Strapi's email provider system already supports SMTP, SendGrid, Mailgun, Amazon SES, etc. — every provider users already configure for the rest of their Strapi project. Reusing it means zero new abstraction, the user configures email once for the whole project, and we inherit any provider improvements Strapi ships. The plugin's notification rules just hand a built email payload to `strapi.plugin('email').service('email').send(...)`.

## Webhook delivery / job queue
- **Choice**: BullMQ + Redis when Redis is available; inline exponential-backoff retry as a fallback when Redis is not configured
- **Considered**: Inline retry only, p-queue (no Redis), required Redis
- **Why**: Webhooks need real reliability — reasonable retry semantics, observability into delivery history, and survival across Strapi process restarts. BullMQ is the standard Node.js answer for this. **However**, requiring Redis would dramatically raise the install bar for evaluators, hobbyists, and small projects (Stage 1 wants this to be the default install — friction kills that). Making Redis optional is the right tradeoff: zero-config installs work, and serious production deployments add Redis.
- **Implication for code**: webhook delivery sits behind a `WebhookDispatcher` interface with two implementations (`BullMQDispatcher`, `InlineDispatcher`). Selection happens at plugin bootstrap based on whether Redis config is present. The rest of the codebase doesn't care which mode is active.
- **Documented limitation**: in inline mode, a Strapi process crash mid-retry loses pending retries. This is acceptable for evaluation/development; the docs strongly recommend Redis for production.

## Custom field type registration API
- **Choice**: Explicit two-sided registration mirroring Strapi's `customFields.register()` paradigm — `strapi.plugin('forms').service('fieldRegistry').register(...)` on the server, `app.getPlugin('forms').registerFieldType(...)` on the admin
- **Considered**: File-based auto-discovery, hybrid with discovery as a convenience layer
- **Why**: Strapi developers already know the `customFields.register()` shape — mirroring it means zero new mental model for Devin. Plugin-based distribution unlocks the marketplace play for third-party form field types (matching the WP form ecosystem's third-party add-on patterns). Explicit beats implicit for plugin authoring (file-scanning gets weird with bundlers, monorepos, and Strapi's build pipeline). Same registry serves the visual builder, the AI builder's vocabulary, and the embed snippet — schema-first principle paying off.
- **Note**: this is not literally `strapi.customFields.register()` (that's for adding field types to *content types*). We're inventing our own *parallel* registry for **form field types**, but matching the API shape so the cognitive model carries over.

## TypeScript strictness
- **Choice**: TypeScript strict mode for the plugin code and the embed snippet; Zod-derived types for the canonical form schema
- **Considered**: Strict everywhere, looser for productivity
- **Why**: Strict mode catches real bugs early, especially in a multi-surface codebase (admin, server, embed) where schemas flow between contexts. Zod-derived types via `z.infer` give us a single source of truth — the schema is *the* contract, and types follow from it rather than being declared separately and drifting. The embed snippet specifically benefits from strict mode because it has zero framework safety net.

## Testing
- **Choice**: Vitest for unit and integration tests in v1; defer Playwright/E2E to v2
- **Considered**: Vitest + Playwright now, Jest
- **Why**: Vitest is fast, Vite-native (matches the embed snippet build), and supports both unit and integration testing well. E2E tests against the Strapi admin are valuable but expensive to write and maintain — for a bootstrapped v1, Vitest coverage of the schema validation, AI provider abstraction, webhook dispatcher, and field registry is high-leverage; admin E2E tests can wait until the visual builder is more stable.

## Documentation
- **Choice**: GitHub README + a `docs/` folder of markdown for v1; real docs site (e.g., Docusaurus or VitePress) for v2
- **Considered**: Docusaurus, Mintlify, VitePress in v1
- **Why**: A docs site is overhead for a v1 with a small audience. A clean README plus a `docs/` folder browsable on GitHub gets you 90% of what users need at 10% of the effort. The schema documentation specifically is essential and needs to be polished, but it's just a markdown file. When the audience grows and maintaining the README becomes painful, that's the signal to invest in a docs site.

## Telemetry / analytics
- **Choice**: No telemetry in v1
- **Considered**: Opt-in usage telemetry, opt-in crash reporting
- **Why**: Bootstrapped product, privacy-conscious audience (European agencies are a likely early-adopter segment), one less moving part. Telemetry adds privacy considerations, GDPR responsibilities, infrastructure (where do events go? who sees them?), and complexity in a free open-source plugin. Better to ship without it and add opt-in telemetry later if there's a clear question that telemetry would answer.

## Hosting & distribution
- **Choice**: Plugin published to npm and listed on the Strapi Marketplace; embed snippet published to npm with a CDN distribution (jsDelivr / unpkg) for `<script>` tag use
- **Considered**: n/a — these are the standard distribution channels
- **Why**: The Strapi Marketplace is the discovery channel for the primary persona (Maya, agency PM — Stage 2). npm is the install channel for everyone. The CDN distribution of the embed snippet is what makes the "drop a script tag on any HTML page, no build step" promise real.

## CI/CD
- **Choice**: GitHub Actions for CI (lint, typecheck, test, build); manual `npm publish` for v1 releases
- **Considered**: changesets / semantic-release for automated releases
- **Why**: Manual releases are fine for the early phase when the team is small and release cadence is deliberate. Automated release pipelines are valuable but add complexity that pays off later. Easy to upgrade when needed.

---

## Decisions deferred to Stage 5

These came up during Stage 4 but are better resolved with concrete schemas in hand:

- **Exact shape of the canonical form schema** (Zod definition) — the most important artifact in the whole product, deserves its own section in Stage 5
- **Concrete content type definitions** for `forms`, `submissions`, `notification_rules`, `webhook_configs` — fields, types, indexes
- **Knex schema** for `webhook_delivery_log` and `notification_delivery_log` — column types, indexes, retention strategy
- **The `AiProvider` interface signature** — what methods, what input/output types
- **The `WebhookDispatcher` interface signature** — same
- **The `formFieldTypes.register()` API signature** for both server and admin sides — matching the shape of Strapi's `customFields.register()`
- **REST/GraphQL endpoint surface** for forms, submissions, schema fetch, submission accept

## Environment variables (preliminary list)

To be finalized in Stage 5, but the shape we're heading toward:

- `STRAPI_FORMS_AI_PROVIDER` — `anthropic` | `openai` | `ollama` | `none`
- `STRAPI_FORMS_AI_API_KEY` — provider API key (when applicable)
- `STRAPI_FORMS_AI_BASE_URL` — for self-hosted/local endpoints (Ollama, etc.)
- `STRAPI_FORMS_AI_MODEL` — provider-specific model name
- `STRAPI_FORMS_REDIS_URL` — when set, BullMQ is used; when unset, inline retry is the fallback
- `STRAPI_FORMS_WEBHOOK_RETRY_MAX` — retry cap (defaults to a sane number)
- `STRAPI_FORMS_WEBHOOK_HMAC_SECRET` — optional, for HMAC-signed webhook payloads

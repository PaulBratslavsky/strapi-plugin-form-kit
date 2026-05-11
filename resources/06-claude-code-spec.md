# Strapi Forms — Claude Code Build Spec

**This file is self-contained.** It synthesizes the product, user, requirements, tech, and engineering blueprint from `01-product.md` through `05-tech-requirements.md` into a build-ready spec. Reference those files for the full reasoning behind each decision; everything you need to act is here.

---

## Project overview

**Strapi Forms** is a native Strapi v5 plugin that lets marketing/content teams build, embed, manage, and route forms without leaving the Strapi admin — a "WPForms for Strapi" with a schema-first, AI-augmented architecture.

**One-liner**: A native Strapi plugin that lets marketing and content teams build, embed, and manage forms — from drag-and-drop creation to submission review to integrations — without leaving the Strapi admin.

**Build sequencing for this spec**: free MVP first, **without the AI builder** (Phase 1, milestones M1–M8). The AI builder ships as **Phase 2** once the foundation is stable and battle-tested. Pro features ship as Phase 3. This sequencing keeps AI risk off the critical path and produces a useful, shippable v1 sooner.

---

## Stack

| Layer | Choice |
|---|---|
| Strapi | v5 only |
| Plugin scaffold | Official Strapi Plugin SDK (`npx create-strapi-plugin`) |
| Schema | Zod (canonical form schema, runtime validation, type inference) |
| Admin UI | Strapi Design System (`@strapi/design-system`, `@strapi/icons`) |
| Drag-and-drop | `@dnd-kit/react` (the new v0.x package) |
| Database | Hybrid: Strapi content types for user-facing entities; Knex-backed custom tables for delivery logs |
| Email | Strapi's existing email plugin / provider config (no new abstraction) |
| Webhooks | BullMQ + Redis when configured; inline retry fallback when not |
| Embed snippet | Vanilla TS + Vite, ESM + IIFE bundles |
| AI (Phase 2) | TanStack AI behind a thin internal `AiProvider` interface |
| Testing | Vitest |
| TypeScript | Strict mode for plugin and embed; Zod-derived types for the schema |
| Distribution | Plugin → npm + Strapi Marketplace; Embed → npm + CDN (jsDelivr/unpkg) |

---

## Repository layout

Two packages in a monorepo. Use pnpm workspaces (or npm workspaces if simpler).

```
strapi-forms/
├── package.json                    # workspace root
├── pnpm-workspace.yaml             # or npm workspaces config
├── tsconfig.base.json
├── README.md
├── docs/                           # markdown docs for v1
│   ├── getting-started.md
│   ├── form-schema.md              # the canonical Zod schema, documented
│   ├── custom-field-types.md
│   ├── embed-snippet.md
│   ├── notifications.md
│   ├── webhooks.md
│   └── ai-builder.md               # added in Phase 2
└── packages/
    ├── plugin/                     # the Strapi plugin
    │   ├── package.json
    │   ├── strapi-server.ts
    │   ├── strapi-admin.ts
    │   ├── server/
    │   │   └── src/
    │   │       ├── index.ts
    │   │       ├── register.ts
    │   │       ├── bootstrap.ts
    │   │       ├── content-types/
    │   │       │   ├── form/
    │   │       │   ├── submission/
    │   │       │   ├── notification-rule/
    │   │       │   ├── webhook-config/
    │   │       │   └── ai-provider-config/
    │   │       ├── controllers/
    │   │       ├── services/
    │   │       │   ├── field-registry.ts
    │   │       │   ├── form-schema-validator.ts
    │   │       │   ├── webhook-dispatcher/
    │   │       │   │   ├── interface.ts
    │   │       │   │   ├── bullmq.ts
    │   │       │   │   └── inline.ts
    │   │       │   ├── notification-dispatcher.ts
    │   │       │   └── ai/                         # Phase 2
    │   │       │       ├── interface.ts
    │   │       │       ├── anthropic.ts
    │   │       │       ├── openai.ts
    │   │       │       ├── ollama.ts
    │   │       │       └── none.ts
    │   │       ├── routes/
    │   │       ├── policies/
    │   │       ├── database/
    │   │       │   └── migrations/                 # Knex migrations for delivery log tables
    │   │       ├── schemas/                        # Zod definitions
    │   │       │   ├── form-schema.ts              # the canonical FormSchema
    │   │       │   ├── field-types.ts
    │   │       │   └── validation-rules.ts
    │   │       └── core-field-types.ts             # registers the 12 core types at bootstrap
    │   └── admin/
    │       └── src/
    │           ├── index.tsx
    │           ├── pages/
    │           │   ├── FormsList.tsx
    │           │   ├── NewForm.tsx
    │           │   ├── FormBuilder.tsx
    │           │   ├── SubmissionsInbox.tsx
    │           │   ├── NotificationsPage.tsx
    │           │   ├── WebhooksPage.tsx
    │           │   └── SettingsPage.tsx
    │           ├── components/
    │           │   ├── builder/
    │           │   │   ├── FieldPalette.tsx
    │           │   │   ├── FormCanvas.tsx
    │           │   │   ├── FieldConfigPanel.tsx
    │           │   │   └── FormSettingsPanel.tsx
    │           │   ├── submissions/
    │           │   │   ├── SubmissionsTable.tsx
    │           │   │   ├── SubmissionDetailDrawer.tsx
    │           │   │   ├── SubmissionFilters.tsx
    │           │   │   └── ExportCsvButton.tsx
    │           │   ├── shared/
    │           │   │   ├── CopyAiPromptButton.tsx
    │           │   │   └── EmbedCodeSnippet.tsx
    │           │   └── ai/                         # Phase 2
    │           │       └── AiBuilderPanel.tsx
    │           ├── hooks/
    │           │   ├── useFormSchema.ts            # reducer + persistence for the form being edited
    │           │   ├── useFieldRegistry.ts
    │           │   └── useSubmissions.ts
    │           ├── contexts/
    │           │   └── FieldRegistryContext.tsx
    │           └── api.ts                          # admin-side API client wrapping useFetchClient
    └── embed/                      # the embed snippet package (separate npm package)
        ├── package.json
        ├── vite.config.ts
        ├── README.md
        ├── src/
        │   ├── index.ts            # public renderForm() API + IIFE auto-init
        │   ├── render.ts
        │   ├── validate.ts         # client-side validation against the schema
        │   ├── submit.ts
        │   ├── field-renderers/    # one renderer per core field type
        │   └── styles.css          # the documented CSS hooks (.sf-*)
        └── tests/
```

---

## Setup commands

```bash
# 1. Create the monorepo
mkdir strapi-forms && cd strapi-forms
git init
pnpm init                      # create root package.json
echo "packages:\n  - 'packages/*'" > pnpm-workspace.yaml

# 2. Create the plugin package
cd packages
npx create-strapi-plugin plugin   # name: "forms" inside, but workspace path is "plugin"
cd plugin
pnpm add zod @dnd-kit/react bullmq ioredis
pnpm add -D vitest @types/node typescript

# 3. Create the embed package
cd ..
mkdir embed && cd embed
pnpm init
pnpm add -D vite typescript vitest @types/node

# 4. Initialize tsconfig.base.json at the root with strict mode
# 5. Set up Vitest at both packages with shared config
# 6. Add a test Strapi v5 project at /test-app to develop the plugin against
cd ../..
npx create-strapi-app@latest test-app --quickstart --no-run
# Link the plugin into test-app via the plugin's path
```

**Required system dependencies for full functionality**:
- Node.js 20+ (Strapi v5 requirement)
- A database (SQLite/Postgres/MySQL — Strapi's choice)
- Redis (optional — only required for production-grade webhook reliability)

---

## Build order — milestones

Each milestone has a clear "done when" criterion. **Build them in order.** A milestone is not done until its acceptance criterion passes; do not start the next one until the current one is shippable.

### Phase 1 — Free MVP without AI

#### Milestone 1: Plugin scaffold + Strapi v5 wiring

**Goal**: empty plugin installed in a test Strapi v5 project, plugin appears in the admin sidebar, basic monorepo CI green.

**Tasks**:
- [ ] Scaffold the plugin via `npx create-strapi-plugin`
- [ ] Set up pnpm workspaces with `packages/plugin` and `packages/embed`
- [ ] Configure shared `tsconfig.base.json` with strict mode
- [ ] Set up Vitest in both packages
- [ ] Set up GitHub Actions: lint, typecheck, test, build
- [ ] Create a `test-app/` Strapi project that links to the plugin for development
- [ ] Verify the plugin shows up in the test-app's admin sidebar

**Done when**: `pnpm dev` in `test-app` boots Strapi, the Forms plugin appears in the admin sidebar with a placeholder page, and CI passes.

---

#### Milestone 2: Canonical schema + content types + field registry

**Goal**: data model exists. Forms and submissions can be created/read via Strapi's auto-generated admin API. Schema validation works on form save. The 12 core field types are registered.

**Tasks**:
- [ ] Define the Zod `FormSchema` in `server/src/schemas/form-schema.ts` per Stage 5 section 1
- [ ] Define Zod schemas for each of the 12 core field types as discriminated union members
- [ ] Define the `FieldRegistry` service (`server/src/services/field-registry.ts`) per Stage 5 section 5
- [ ] Define `FormSchemaValidator` service per Stage 5 section 5
- [ ] Create the 5 Strapi content types per Stage 5 section 2:
  - `form`, `submission`, `notification-rule`, `webhook-config`, `ai-provider-config`
- [ ] Each content type has its schema.json + lifecycle file
- [ ] On `forms` content type, `beforeCreate` and `beforeUpdate` lifecycles validate the `schema` JSON column against `FormSchema` — invalid schemas reject with field-level errors
- [ ] At plugin bootstrap, register all 12 core field types with the `FieldRegistry`
- [ ] Encrypted-at-rest helpers for `webhook_configs.hmacSecret` and `ai_provider_configs.apiKey` using `process.env.APP_KEYS[0]`
- [ ] Unit tests: schema validation, field registry registration, encryption helpers

**Done when**: a form document with a valid `FormSchema` can be created via Strapi's admin API; invalid ones are rejected; submissions can be created and store the JSON `data` field; field registry exposes the 12 core types via `list()`.

---

#### Milestone 3: Public REST endpoints (schema + submit)

**Goal**: a frontend can fetch a form's schema and post a submission to it. Honeypot spam protection works. No admin UI yet — endpoints are tested via curl/Postman.

**Tasks**:
- [ ] Implement `GET /api/forms/:slug/schema` — returns `FormSchema` for published forms by slug
- [ ] Implement `POST /api/forms/:slug/submit` — validates submission data against the form's current schema using `FormSchemaValidator`, persists, returns success message
- [ ] Honeypot handling: if the honeypot field is non-empty, persist with `status='spam'` and return 201 success anyway (so bots can't probe)
- [ ] Submission metadata captured: `{ ip, userAgent, referrer, submittedAt, formSchemaVersion }`
- [ ] Public route configuration (no auth required by default; auth required if `form.settings.authenticatedOnly` is true)
- [ ] Reject submissions to draft (unpublished) forms with 404
- [ ] Integration tests: round-trip submission flow with valid + invalid data + honeypot

**Done when**: in the test-app, you can `curl -X POST` a submission to a published form and see it in the database with the correct status; honeypot triggers correctly; field-level validation errors return a structured 400 response.

---

#### Milestone 4: Visual form builder UI

**Goal**: Maya/Chen can build a form via drag-and-drop in the Strapi admin, save it, and see it persist. No notifications/webhooks/AI yet.

**Tasks**:
- [ ] Admin route: `/plugins/forms/forms` — list view with all forms, search, status filter, "Create new" button
- [ ] Admin route: `/plugins/forms/forms/new` — for now, just opens a blank builder (AI option is Phase 2)
- [ ] Admin route: `/plugins/forms/forms/edit/:documentId` — the visual builder
- [ ] Visual builder layout: left sidebar (FieldPalette), center canvas (FormCanvas), right sidebar (FieldConfigPanel or FormSettingsPanel)
- [ ] Drag-and-drop with `@dnd-kit/react`:
  - Drag from FieldPalette into FormCanvas appends a new field
  - Reorder fields within FormCanvas
  - Keyboard accessible per dnd-kit defaults
- [ ] FieldConfigPanel — renders the per-field-type configuration form (label, help text, validation rules, type-specific options like dropdown choices)
- [ ] FormSettingsPanel — submit button label, success message, error message, redirect URL, honeypot toggle
- [ ] `useFormSchema` reducer hook that holds the form draft and applies all edits while keeping the schema valid at every step
- [ ] Save action persists the schema to the backend; reload restores it; explicit save button (no autosave in v1)
- [ ] Form list shows a "Copy embed snippet" action with the `<script>` tag + `<div data-strapi-form="...">` pre-filled
- [ ] All UI uses Strapi Design System components only — no custom UI library

**Done when**: a user can log into the admin, click "New form," drag-and-drop 5 fields including a dropdown with multiple options, configure validation rules, save, reload the page, and see the same form intact.

---

#### Milestone 5: Embed snippet (separate package)

**Goal**: a marketer can paste a 2-line `<script>` tag onto any HTML page and a working form renders, validates, and submits to Strapi.

**Tasks**:
- [ ] Set up `packages/embed` with Vite, dual-output (ESM + IIFE)
- [ ] Implement `renderForm({ target, baseUrl, slug, hooks?, fieldRenderers? })` programmatic API
- [ ] Implement IIFE auto-init: scan for `[data-strapi-form]` elements at page load and render them
- [ ] Implement renderers for all 12 core field types
- [ ] Client-side validation against the schema fetched from `/api/forms/:slug/schema`
- [ ] Submission posts to `/api/forms/:slug/submit`; handles 400 field-level errors; handles success state with the configured success message; handles redirect URL when set
- [ ] CSS hook contract per Stage 5 section 9 — every meaningful element gets a `.sf-*` class
- [ ] Basic accessibility: proper labels, ARIA attributes, keyboard navigation, error message association
- [ ] JS extension points: `beforeSubmit`, `afterSubmit`, `onValidationError`, custom `fieldRenderers` map
- [ ] Bundle-size CI check enforcing < 20KB gzipped (hard ceiling 30KB)
- [ ] Publish to npm; configure CDN distribution via jsDelivr/unpkg

**Done when**: in a fresh static HTML file with no build step, dropping in `<div data-strapi-form="contact" data-strapi-base-url="..."></div>` plus the `<script>` tag renders a working form, validates input, submits, shows the success message, and persists the submission in Strapi. Bundle is under 20KB gzipped.

---

#### Milestone 6: Notifications (email)

**Goal**: when a form is submitted, configured email notifications fire reliably and failures are logged.

**Tasks**:
- [ ] Admin route: `/plugins/forms/forms/edit/:documentId/notifications` — list/create/edit notification rules for a form
- [ ] Notification rule fields per Stage 5 section 2: `name`, `recipients`, `subjectTemplate`, `bodyTemplate`, `enabled`
- [ ] Template engine: support `{{fieldId}}`, `{{fieldLabel}}`, and `{{all}}` placeholders in subject and body
- [ ] On submission: synchronously dispatch all enabled notification rules for the form using Strapi's email plugin (`strapi.plugin('email').service('email').send(...)`)
- [ ] Errors during dispatch are caught, logged to `strapi_forms_notification_delivery_log`, but do not propagate to the public submission response (the submission still succeeds)
- [ ] Knex migration creates `strapi_forms_notification_delivery_log` table per Stage 5 section 3
- [ ] Admin UI shows recent delivery log entries per rule (`GET /forms-plugin/admin/notifications/:ruleId/deliveries`)
- [ ] Integration tests: submission triggers email, failure is logged

**Done when**: configuring a notification rule, submitting the form, and seeing the email arrive in a test inbox; deliberately misconfiguring SMTP and seeing the failure show up in the delivery log without crashing the submission.

---

#### Milestone 7: Webhooks (BullMQ + inline fallback)

**Goal**: webhook configurations exist, fire on submission, retry on failure, and survive a Strapi restart when Redis is configured.

**Tasks**:
- [ ] Admin route: `/plugins/forms/forms/edit/:documentId/webhooks` — list/create/edit webhook configs
- [ ] Webhook config fields per Stage 5 section 2: `name`, `url`, `method`, `headers`, `hmacSecret` (encrypted), `enabled`
- [ ] `WebhookDispatcher` interface per Stage 5 section 5
- [ ] `BullMQDispatcher` implementation: enqueues delivery, retries with exponential backoff up to `STRAPI_FORMS_WEBHOOK_RETRY_MAX`, writes to `strapi_forms_webhook_delivery_log` after each attempt
- [ ] `InlineDispatcher` implementation: `setTimeout`-based exponential backoff retry, same logging behavior, logs a warning at bootstrap that this mode is dev-only
- [ ] Plugin bootstrap selects implementation based on whether `STRAPI_FORMS_REDIS_URL` is set
- [ ] HMAC signing: when `hmacSecret` is set on a webhook config, the request includes a `X-Strapi-Forms-Signature` header (HMAC-SHA256 of the body)
- [ ] Knex migration creates `strapi_forms_webhook_delivery_log` table per Stage 5 section 3
- [ ] Admin UI shows recent delivery log entries per webhook (`GET /forms-plugin/admin/webhooks/:configId/deliveries`)
- [ ] On submission: enqueue all enabled webhooks for the form via `WebhookDispatcher.dispatch()`
- [ ] Integration tests: success delivery, transient failure retried, permanent failure exhausts retries and logs

**Done when**: configuring a webhook to a real test endpoint (e.g., webhook.site), submitting the form, and seeing the webhook fire; deliberately breaking the URL and seeing the retry attempts in the delivery log; both Redis-on and Redis-off paths work end-to-end.

---

#### Milestone 8: Submissions inbox

**Goal**: Chen's daily UX. Filter, search, mark-as-read, mark-as-spam, export.

**Tasks**:
- [ ] Admin route: `/plugins/forms/submissions/:formDocumentId` — submissions inbox for a single form
- [ ] Tabs for `submitted` (default), `read`, `spam`; each tab is a filtered query
- [ ] Free-text search across the JSON `data` field
- [ ] Date range filter
- [ ] SubmissionDetailDrawer — side drawer showing all field values for a submission, with field labels resolved from the schema (not raw UUIDs)
- [ ] Status-change action: `POST /forms-plugin/admin/submissions/:documentId/status`
- [ ] Bulk actions: select multiple submissions, mark all as read, mark all as spam, delete
- [ ] CSV export: `GET /forms-plugin/admin/submissions/:formDocumentId/export.csv` with the same query params as the UI filters
- [ ] Sidebar badge count for new (status=submitted) submissions

**Done when**: Chen can log in, see a count of new submissions, click through to the inbox, filter to "submitted," open a submission, mark it read, and export the filtered set as CSV.

---

#### Milestone 9: "Copy as AI prompt" + docs polish + release prep

**Goal**: ship-ready free MVP. The product can be installed from npm, documented, and onboarded.

**Tasks**:
- [ ] Implement `GET /forms-plugin/admin/forms/:documentId/copy-as-ai-prompt` — server endpoint that returns a pre-built prompt string bundling the form's schema with instructions for an external LLM
- [ ] Add `CopyAiPromptButton` to the form edit view; click copies the result to clipboard
- [ ] Plugin settings page (`/plugins/forms/settings`) — accessible from Strapi's settings menu (AI provider config UI is added in Phase 2; for v1 free MVP, only the email-from override lives here)
- [ ] Permissions: define plugin permissions following Stage 3 (form create/read/update/delete, submission read/update/delete, notification config, webhook config). Map to Strapi role-based access control
- [ ] "Client editor" role recipe documented in `docs/permissions.md` showing how an agency creates a role for client handoff
- [ ] Write `docs/getting-started.md`, `docs/form-schema.md`, `docs/embed-snippet.md`, `docs/custom-field-types.md`, `docs/notifications.md`, `docs/webhooks.md`, `docs/permissions.md`
- [ ] Polish README with screenshots, install instructions, link to docs/
- [ ] Verify all Stage 3 free-MVP acceptance criteria pass (see "POC acceptance criteria" below)
- [ ] Tag v0.1.0, publish plugin to npm, publish embed package to npm, submit plugin to Strapi Marketplace

**Done when**: a developer can run `npm install strapi-plugin-forms` in a fresh Strapi v5 project, follow the README, and ship a working contact form in under 15 minutes — all without touching the Phase 2 AI features.

---

### Phase 2 — AI builder

Layered onto a stable Phase 1 base. AI failures should never break the rest of the plugin.

#### Milestone 10: AI provider abstraction + provider implementations

**Goal**: configurable BYOK AI works end-to-end. AI generates valid form schemas.

**Tasks**:
- [ ] Define `AiProvider` interface per Stage 5 section 5 (`generateForm`, `refineForm`, `healthCheck`)
- [ ] Implement adapters using TanStack AI: `AnthropicProvider`, `OpenAIProvider`, `OllamaProvider`, `NoneProvider`
- [ ] Configuration: read from `ai_provider_configs` (single type) with env var override (`STRAPI_FORMS_AI_*`)
- [ ] Server endpoint `POST /forms-plugin/admin/ai/generate` — accepts a prompt, returns a draft `FormSchema`
- [ ] Server endpoint `POST /forms-plugin/admin/ai/refine` — accepts an instruction + current schema, returns a new schema
- [ ] Server endpoint `GET /forms-plugin/admin/ai/health` — returns provider reachability
- [ ] Output validation: AI output is parsed against `FormSchema` Zod; invalid output triggers up to 2 auto-retries with a "fix this and return only valid JSON" follow-up prompt; persistent failure surfaces as a 502 with a clear error message
- [ ] Field registry passed to the AI as part of the prompt — AI knows which field types are available (including custom ones)
- [ ] AI provider config UI in the plugin settings page (provider selection, API key, base URL, model)
- [ ] Unit tests with mocked TanStack AI responses; integration tests against a real provider in CI (using a dedicated test key)

**Done when**: configuring an Anthropic API key via the settings UI, typing "build a contact form for an architecture firm with name, email, and project type" into a test client, and getting back a valid `FormSchema` that opens cleanly in the visual builder.

---

#### Milestone 11: AI builder UI

**Goal**: Maya and Chen can build forms via natural language inside the admin.

**Tasks**:
- [ ] `AiBuilderPanel` component — chat surface used in two places:
  - On `/plugins/forms/forms/new`, as a primary creation path
  - On `/plugins/forms/forms/edit/:documentId`, as a collapsible side-panel for refinements
- [ ] Empty state in the builder when AI is not configured — link to the settings page
- [ ] Generated drafts open directly in the visual builder (FormCanvas pre-populated)
- [ ] Refinement flow: user types instruction, AI returns updated schema, visual builder updates with a diff visualization (added fields highlighted, removed fields struck through) — user can accept or reject
- [ ] Loading states and error handling: provider down, invalid output after retries, rate-limit errors
- [ ] Documentation: `docs/ai-builder.md` covering BYOK setup for each provider including local Ollama

**Done when**: a user with an AI provider configured can type "lead-gen form: name, email, company, role dropdown" and have a draft form appear in under 5 seconds, openable and editable in the visual builder.

---

### Phase 3 — Pro tier (out of scope for this spec)

Listed for reference. Build sequence and detail to be specified once Phase 1 and Phase 2 are shipped and we have user feedback. Items: conditional logic, multi-step forms, file uploads, advanced spam protection (reCAPTCHA/hCaptcha), templates library + cross-project blueprints, native integrations (Mailchimp/HubSpot/Slack/Zapier), custom submission statuses, MCP server.

---

## Data models

### Zod canonical form schema

See Stage 5 section 1 for the full Zod definition. Key types:

```typescript
// Validation rule — discriminated union on `kind`
type ValidationRule =
  | { kind: 'required'; message?: string }
  | { kind: 'minLength'; value: number; message?: string }
  | { kind: 'maxLength'; value: number; message?: string }
  | { kind: 'min'; value: number; message?: string }
  | { kind: 'max'; value: number; message?: string }
  | { kind: 'pattern'; regex: string; message?: string }
  | { kind: 'email'; message?: string }
  | { kind: 'url'; message?: string };

// Field — discriminated union on `type`. Twelve core types in v1.
// Custom types extend at runtime via the field registry.

// Form-wide settings
type FormSettings = {
  submitButtonLabel: string;        // default 'Submit'
  successMessage: string;           // default 'Thank you...'
  errorMessage: string;             // default 'Something went wrong...'
  redirectUrl?: string;
  honeypotEnabled: boolean;         // default true
  authenticatedOnly: boolean;       // default false
};

// The full canonical form schema
type FormSchema = {
  schemaVersion: 1;
  fields: Field[];                  // min 1
  settings: FormSettings;
};
```

### Strapi content types

Defined in `server/src/content-types/`. Each is a directory with `schema.json`, `controllers.ts`, `routes.ts`, `services.ts`, and `lifecycles.ts`.

| Content type | Purpose | Public-readable? |
|---|---|---|
| `form` | Form definitions; `schema` JSON column holds the canonical Zod-validated form schema | Schema only, via `/api/forms/:slug/schema` |
| `submission` | One row per submission; `data` JSON keyed by field UUID; status enum; metadata JSON | No (writes via `/api/forms/:slug/submit`) |
| `notification-rule` | Email config attached to a form | Admin only |
| `webhook-config` | Webhook config attached to a form; `hmacSecret` encrypted | Admin only |
| `ai-provider-config` | Single type; provider, encrypted API key, base URL, model | Admin only |

Schemas detailed in Stage 5 section 2.

### Knex custom tables

Migration files in `server/src/database/migrations/`. Two tables:

```sql
-- strapi_forms_webhook_delivery_log
CREATE TABLE strapi_forms_webhook_delivery_log (
  id UUID PRIMARY KEY,
  webhook_config_id INTEGER NOT NULL REFERENCES webhook_configs(id) ON DELETE CASCADE,
  submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL,                         -- 'pending' | 'success' | 'failed' | 'error'
  http_status INTEGER,
  response_body_preview TEXT,
  error_message TEXT,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_ms INTEGER
);
CREATE INDEX ON strapi_forms_webhook_delivery_log (webhook_config_id, attempted_at DESC);
CREATE INDEX ON strapi_forms_webhook_delivery_log (submission_id);
CREATE INDEX ON strapi_forms_webhook_delivery_log (attempted_at);

-- strapi_forms_notification_delivery_log
CREATE TABLE strapi_forms_notification_delivery_log (
  id UUID PRIMARY KEY,
  notification_rule_id INTEGER NOT NULL REFERENCES notification_rules(id) ON DELETE CASCADE,
  submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  recipients JSONB NOT NULL,
  status TEXT NOT NULL,                          -- 'success' | 'failed'
  error_message TEXT,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON strapi_forms_notification_delivery_log (notification_rule_id, attempted_at DESC);
CREATE INDEX ON strapi_forms_notification_delivery_log (submission_id);
CREATE INDEX ON strapi_forms_notification_delivery_log (attempted_at);
```

The above are the Postgres-flavored versions; Knex generates dialect-appropriate variants for SQLite and MySQL.

---

## API endpoints

### Public (no auth required by default)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/forms/:slug/schema` | Return the canonical form schema for a published form |
| POST | `/api/forms/:slug/submit` | Validate and persist a submission; trigger notifications and webhooks |

### Admin (require authenticated admin user with appropriate permissions)

In addition to Strapi's auto-generated CRUD on the content types:

| Method | Path | Purpose | Phase |
|---|---|---|---|
| POST | `/forms-plugin/admin/forms/:documentId/duplicate` | Duplicate a form within the project | 1 |
| POST | `/forms-plugin/admin/submissions/:documentId/status` | Update a submission's status | 1 |
| GET | `/forms-plugin/admin/submissions/:formDocumentId/export.csv` | CSV export with filter params | 1 |
| GET | `/forms-plugin/admin/forms/:documentId/copy-as-ai-prompt` | Pre-built LLM prompt with the form's schema | 1 |
| GET | `/forms-plugin/admin/webhooks/:configId/deliveries` | Recent webhook delivery log entries | 1 |
| GET | `/forms-plugin/admin/notifications/:ruleId/deliveries` | Recent notification delivery log entries | 1 |
| POST | `/forms-plugin/admin/ai/generate` | Generate a draft FormSchema from a prompt | 2 |
| POST | `/forms-plugin/admin/ai/refine` | Refine an existing schema with an instruction | 2 |
| GET | `/forms-plugin/admin/ai/health` | AI provider reachability check | 2 |

Detailed request/response shapes in Stage 5 section 6.

---

## Pages & components

### Admin pages (Phase 1)

| Route | Purpose | Key components |
|---|---|---|
| `/plugins/forms/forms` | List view | `FormsListTable`, `CreateFormButton`, `FormSearchBar` |
| `/plugins/forms/forms/new` | New form chooser (blank in P1; AI option added in P2) | `NewFormChooser` |
| `/plugins/forms/forms/edit/:documentId` | Visual builder | `FieldPalette`, `FormCanvas`, `FieldConfigPanel`, `FormSettingsPanel` |
| `/plugins/forms/submissions/:formDocumentId` | Submissions inbox | `SubmissionsTable`, `SubmissionFilters`, `SubmissionDetailDrawer`, `BulkActionsBar`, `ExportCsvButton` |
| `/plugins/forms/forms/edit/:documentId/notifications` | Email rules | `NotificationRulesList`, `NotificationRuleEditor` |
| `/plugins/forms/forms/edit/:documentId/webhooks` | Webhook configs + delivery log viewer | `WebhookConfigsList`, `WebhookConfigEditor`, `WebhookDeliveryLog` |
| `/plugins/forms/settings` | Plugin settings | `SettingsPage` (email-from override in P1; AI config added in P2) |

### Cross-cutting components

- `CopyAiPromptButton` — visible on the form edit view
- `EmbedCodeSnippet` — visible on the form list and edit views; pre-fills the `<script>` tag and `<div data-strapi-form="...">`
- `FieldRegistryContext` — read once at admin startup, consumed by builder and AI panel

### State management

- Server state: `useFetchClient` (Strapi v5) for all reads/writes
- Form-being-edited: a `useFormSchema` reducer hook holding the draft
- AI chat history: per-session component state (not persisted across reloads in P1/P2)
- Field registry: read once at admin startup, cached in `FieldRegistryContext`

---

## Internal services & interfaces

Defined in detail in Stage 5 section 5. Summary:

| Service | Purpose | Phase |
|---|---|---|
| `FieldRegistry` | Plugin-extensible registry of form field types (server + admin sides) | 1 |
| `FormSchemaValidator` | Validates form definitions and submission data against the canonical schema | 1 |
| `WebhookDispatcher` | Single interface, two implementations: `BullMQDispatcher` (when Redis is configured) and `InlineDispatcher` (fallback) | 1 |
| `NotificationDispatcher` | Wraps Strapi's email plugin; renders templates; logs deliveries | 1 |
| `AiProvider` | Thin abstraction over TanStack AI; implementations for Anthropic / OpenAI / Ollama / None | 2 |

---

## Environment variables

| Variable | Required | Purpose | Example |
|---|---|---|---|
| `STRAPI_FORMS_AI_PROVIDER` | No (P2) | Override DB-stored AI provider | `anthropic` |
| `STRAPI_FORMS_AI_API_KEY` | No (P2) | Override DB-stored AI key | `sk-ant-...` |
| `STRAPI_FORMS_AI_BASE_URL` | No (P2) | Override base URL (Ollama, self-hosted) | `http://localhost:11434/v1` |
| `STRAPI_FORMS_AI_MODEL` | No (P2) | Override model | `claude-opus-4-7` |
| `STRAPI_FORMS_REDIS_URL` | No | When set, BullMQ webhook dispatcher is used. Unset = inline retry fallback. | `redis://localhost:6379` |
| `STRAPI_FORMS_WEBHOOK_RETRY_MAX` | No | Maximum webhook retry attempts | `5` |
| `STRAPI_FORMS_WEBHOOK_HMAC_DEFAULT_SECRET` | No | Default HMAC secret if a webhook config has none set | (random) |

All env vars take precedence over their database-stored counterparts when set.

---

## POC acceptance criteria

The free MVP (Phase 1, M1–M9) is "done" when **all** of the following pass:

- [ ] An agency PM can install the plugin from Strapi's marketplace, build a contact form via drag-and-drop in under 5 minutes, and embed it on any HTML page using the embed snippet with a 2-line `<script>` tag — no developer required for the embed step.
- [ ] A developer can register a custom field type from their host Strapi project code, and that field type appears in the visual builder's field palette.
- [ ] A developer can use the "Copy as AI prompt" action in the admin to get a Claude-ready prompt, paste it into Claude/Cursor, and receive a working framework-native (e.g., React + Tailwind) form component for the form they built.
- [ ] A developer can fully restyle the embed snippet to match a custom design system using only the documented CSS hooks — no JavaScript changes, no forking the snippet.
- [ ] A client marketer can log into Strapi, see a new submission to that form, view its details, mark it read, and export a CSV of all submissions.
- [ ] An email notification fires reliably to a configured address when a form is submitted; failures are logged.
- [ ] A webhook fires reliably to a configured URL when a form is submitted; both Redis-on (BullMQ) and Redis-off (inline) modes work end-to-end.
- [ ] A developer can read the plugin docs and configure a form's submission endpoint to be called from a custom frontend without surprises.
- [ ] The plugin passes a basic load test (1,000 submissions to a single form, list view stays responsive).
- [ ] The plugin works on Strapi v5, on at least Postgres and SQLite.
- [ ] The canonical form schema is documented as a public API artifact (`docs/form-schema.md`) so custom field types, the embed snippet, the AI builder (Phase 2), the LLM-prompt helpers, and future MCP/SDK integrations all have a stable contract to build against.

The Phase 2 AI builder (M10–M11) is "done" when:

- [ ] A user can configure an AI provider (Anthropic key, OpenAI key, or Ollama endpoint), describe a form in natural language, and have a working draft generated in the visual builder in under 5 seconds.
- [ ] AI provider failures (down, rate-limited, invalid output) surface as clean errors in the admin UI without breaking the rest of the plugin.

---

## Open questions / parked items

These came up during design and are deliberately not resolved here. Revisit when relevant.

- **Custom field type rendering on the public frontend.** In v1 the embed snippet renders core types only; devs handle custom-field rendering on the public site themselves using the schema endpoint. If user feedback shows this is a major friction point, design a safe public-side custom-renderer registration model in v1.x.
- **Submission retention policy.** No automatic deletion in v1. Likely a Pro feature in Phase 3 (per-form retention rules + GDPR right-to-be-forgotten).
- **Delivery log retention.** Same — no automatic pruning in v1. Watch volume; revisit when the tables grow into the millions of rows.
- **Multi-step form storage.** When Pro multi-step forms ship, decide whether to add an explicit `pages` field to the schema or model pages as field-grouping metadata. Not blocking v1.
- **i18n support.** Deferred to v2 (per Stage 5). Strapi's built-in i18n can be wired in when forms need to be localized per-locale.
- **MCP server.** Deferred to a later Pro phase. The schema-first architecture is the foundation; once stable, the MCP server is a relatively thin layer on top.
- **Telemetry/analytics.** None in v1; revisit when we have a specific question opt-in telemetry would answer.
- **TypeScript SDK (separate v2 npm package).** Distinct from the embed snippet. Design informed by v1 usage data showing which frameworks the audience actually uses.
- **Submission analytics dashboards.** CSV export only in v1; visual dashboards are v2.
- **AI builder cost guardrails.** BYOK shifts AI cost to the user, but a runaway prompt loop could still be expensive on their key. Consider a per-session call cap as a quality-of-life addition in Phase 2.

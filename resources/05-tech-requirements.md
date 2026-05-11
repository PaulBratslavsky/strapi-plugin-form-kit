# Technical Requirements

The engineering blueprint. Translates Stage 3 (functional requirements) and Stage 4 (tech decisions) into concrete schemas, interfaces, and endpoints. This is what Devin reads to start building.

---

## 1. The canonical form schema (the most important artifact in the product)

Every form is, at its core, a single JSON document conforming to the Zod schema defined here. This document is stored as a JSON column on the `forms` content type, exposed via the public schema API endpoint, produced by the AI builder, edited by the visual builder, consumed by the embed snippet, and (eventually) read/written by the MCP server. **All other surfaces are renderers or editors of this artifact.**

### Top-level form schema

```typescript
import { z } from 'zod';

// === Field validation rule ===
const ValidationRule = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('required'), message: z.string().optional() }),
  z.object({ kind: z.literal('minLength'), value: z.number().int().nonnegative(), message: z.string().optional() }),
  z.object({ kind: z.literal('maxLength'), value: z.number().int().positive(), message: z.string().optional() }),
  z.object({ kind: z.literal('min'), value: z.number(), message: z.string().optional() }),
  z.object({ kind: z.literal('max'), value: z.number(), message: z.string().optional() }),
  z.object({ kind: z.literal('pattern'), regex: z.string(), message: z.string().optional() }),
  z.object({ kind: z.literal('email'), message: z.string().optional() }),
  z.object({ kind: z.literal('url'), message: z.string().optional() }),
]);

// === Conditional logic (Pro tier — present in schema but ignored in free tier) ===
const ConditionalRule = z.object({
  show: z.boolean(),                              // show or hide the field
  when: z.object({
    fieldId: z.string(),                          // reference another field by id
    operator: z.enum(['equals', 'notEquals', 'contains', 'isEmpty', 'isNotEmpty']),
    value: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
  }),
});

// === Choice option (for dropdown, radio, checkbox) ===
const ChoiceOption = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
});

// === Field — discriminated union over the core field types ===
// Each field has a unique `id` that is stable across edits (used for submissions, conditional logic, etc.)
const FieldBase = z.object({
  id: z.string().uuid(),                          // stable across edits
  label: z.string().min(1),
  helpText: z.string().optional(),
  placeholder: z.string().optional(),
  defaultValue: z.unknown().optional(),
  validations: z.array(ValidationRule).default([]),
  conditional: ConditionalRule.optional(),        // Pro feature — ignored in free
});

const Field = z.discriminatedUnion('type', [
  FieldBase.extend({ type: z.literal('text') }),
  FieldBase.extend({ type: z.literal('textarea'), rows: z.number().int().min(2).max(20).default(4) }),
  FieldBase.extend({ type: z.literal('email') }),
  FieldBase.extend({ type: z.literal('number'), step: z.number().optional() }),
  FieldBase.extend({ type: z.literal('phone') }),
  FieldBase.extend({ type: z.literal('url') }),
  FieldBase.extend({ type: z.literal('dropdown'), options: z.array(ChoiceOption).min(1) }),
  FieldBase.extend({ type: z.literal('radio'), options: z.array(ChoiceOption).min(1) }),
  FieldBase.extend({ type: z.literal('checkboxes'), options: z.array(ChoiceOption).min(1) }),
  FieldBase.extend({ type: z.literal('date'), min: z.string().optional(), max: z.string().optional() }),
  FieldBase.extend({ type: z.literal('hidden'), defaultValue: z.string() }),
  FieldBase.extend({ type: z.literal('content'), html: z.string() }),  // section header / instructions
  // Custom field types extend the union at runtime via the registry — see section 4
]);

// === Form-wide settings ===
const FormSettings = z.object({
  submitButtonLabel: z.string().default('Submit'),
  successMessage: z.string().default('Thank you for your submission.'),
  errorMessage: z.string().default('Something went wrong. Please try again.'),
  redirectUrl: z.string().url().optional(),       // optional redirect after successful submit
  honeypotEnabled: z.boolean().default(true),     // free-tier spam protection
  authenticatedOnly: z.boolean().default(false),  // require Strapi auth to submit (rare)
});

// === The full form schema ===
const FormSchema = z.object({
  schemaVersion: z.literal(1),                     // bump on breaking changes
  fields: z.array(Field).min(1),
  settings: FormSettings,
});

export type FormSchema = z.infer<typeof FormSchema>;
```

### Why this shape

- **Discriminated union on `type`** for fields means TypeScript narrows the field's properties correctly per type, AI structured-output works cleanly, and the visual builder's per-type config panel is easy to render.
- **Stable field `id`s (UUIDs)** mean a field's identity survives label changes — submissions stored against `id` remain valid even if the user renames the label.
- **`schemaVersion`** explicitly versions the schema. When v2 adds breaking changes, we bump this and write a migration. Embed snippets and the API check this number to fail loudly on incompatible mismatches.
- **`conditional` is in the schema but ignored in free tier.** Pro just turns it on; no schema change needed when Pro ships. Same for any future Pro additions.
- **`content` field type** is for section headers and instructional text between fields — a small touch that significantly raises perceived form quality.
- **Custom field types extend at runtime**, not at schema-author time. The `Field` union above is the *core set*; the `fieldRegistry` adds more entries. See section 4.

### Schema versioning policy

- `schemaVersion: 1` is the v1 contract.
- Additive changes (new optional fields, new validation rules, new field types in the registry) do not bump the version.
- Breaking changes (renaming a field property, removing a field type, changing semantic meaning) bump the version. Old forms migrate forward; the API can serve the old version if asked.

---

## 2. Strapi content types

Defined in the plugin's `server/src/content-types/`. Strapi handles tables, migrations, and CRUD via the entity service.

### `forms` (collection type)

Stores form definitions. Public-facing reads via the schema API; admin reads/writes via Strapi's standard authenticated APIs.

| Field | Type | Notes |
|---|---|---|
| `id` | integer | Strapi's internal primary key |
| `documentId` | string | Strapi v5's public document ID (UUIDv4) — used as the form's public ID everywhere |
| `name` | string, required | Internal name shown in admin (e.g., "Contact form") |
| `slug` | string, required, unique | URL-safe identifier for the form (e.g., `contact`) |
| `description` | text | Optional internal description for the team |
| `schema` | JSON, required | The canonical Zod-validated `FormSchema` document |
| `publishedAt` | datetime | Strapi's draft/publish indicator (null = draft) |
| `createdAt` | datetime | Strapi-managed |
| `updatedAt` | datetime | Strapi-managed |
| `createdBy` | relation → admin::user | Strapi-managed |
| `updatedBy` | relation → admin::user | Strapi-managed |

**Indexes**: `slug` (unique), `documentId` (unique, Strapi-managed), `publishedAt`.

**Validation**: `schema` is validated against the Zod `FormSchema` in a content-type lifecycle `beforeCreate` and `beforeUpdate` hook. Invalid schemas reject the write with a 400 and field-level errors.

### `submissions` (collection type)

One row per submission. Stores the field values as JSON keyed by field `id` (the stable UUIDs from the form schema).

| Field | Type | Notes |
|---|---|---|
| `id` | integer | Strapi primary key |
| `documentId` | string | Public UUIDv4 for the submission |
| `form` | relation → `plugin::forms.form`, required | The form this submission belongs to |
| `data` | JSON, required | Object keyed by field UUID: `{ "<fieldId>": <value>, ... }` |
| `status` | enum, default `submitted` | `submitted` \| `read` \| `spam` |
| `metadata` | JSON | Submission context: `{ ip, userAgent, referrer, submittedAt, formSchemaVersion }` |
| `createdAt` | datetime | Strapi-managed; equals submission time |
| `updatedAt` | datetime | Strapi-managed |

**Indexes**: `form` (foreign key), `(form, status, createdAt DESC)` compound for the inbox view, `(form, createdAt DESC)` for default ordering.

**Field-level data integrity**: `data` is validated against the form's current schema at submission time on the server. Submissions for fields no longer in the schema are discarded with a warning logged; submissions for new required fields without values fail validation.

**Retention**: no automatic deletion in v1. Admin UI offers manual deletion. (Pro tier may add automated retention rules later.)

### `notification_rules` (collection type)

Email notification configurations attached to forms.

| Field | Type | Notes |
|---|---|---|
| `id` | integer | Strapi primary key |
| `documentId` | string | Public UUIDv4 |
| `form` | relation → `plugin::forms.form`, required | The form this rule belongs to |
| `name` | string, required | Internal name (e.g., "Notify sales team") |
| `recipients` | JSON, required | Array of email addresses |
| `subjectTemplate` | string, required | Subject line; supports `{{fieldId}}` or `{{fieldLabel}}` placeholders |
| `bodyTemplate` | text, required | Plain text body; supports same placeholders + `{{all}}` for full submission |
| `enabled` | boolean, default `true` | Quick toggle without deletion |

**Indexes**: `form`, `(form, enabled)`.

### `webhook_configs` (collection type)

Outgoing webhook configurations attached to forms.

| Field | Type | Notes |
|---|---|---|
| `id` | integer | Strapi primary key |
| `documentId` | string | Public UUIDv4 |
| `form` | relation → `plugin::forms.form`, required | The form this webhook belongs to |
| `name` | string, required | Internal name |
| `url` | string, required | Target URL (validated as URL on save) |
| `method` | enum, default `POST` | `POST` \| `PUT` |
| `headers` | JSON | Optional static headers, `{ "X-Foo": "bar" }` |
| `hmacSecret` | string (encrypted) | Optional; when set, payload is HMAC-signed and a `X-Strapi-Forms-Signature` header is added |
| `enabled` | boolean, default `true` | Quick toggle |

**Indexes**: `form`, `(form, enabled)`.

**Encryption**: `hmacSecret` is stored encrypted at rest using Strapi's app key (`process.env.APP_KEYS[0]`). Decrypted only at dispatch time.

### `ai_provider_configs` (single type)

Per-Strapi-instance AI provider configuration. Single type because there's one configured provider at a time per Strapi project.

| Field | Type | Notes |
|---|---|---|
| `provider` | enum, default `none` | `anthropic` \| `openai` \| `ollama` \| `none` |
| `apiKey` | string (encrypted) | API key for the provider (when applicable) |
| `baseUrl` | string | Optional override (used for Ollama / self-hosted endpoints) |
| `model` | string | Provider-specific model identifier (e.g., `claude-opus-4-7`, `gpt-4o`, `gemma2:9b`) |

**Encryption**: `apiKey` stored encrypted at rest the same way as `hmacSecret`.

**Note**: this can be overridden by environment variables (`STRAPI_FORMS_AI_*`). Env vars win when set — for production deployments where the team doesn't want secrets in the database.

---

## 3. Knex-backed custom tables (delivery logs)

Created by plugin migrations under `server/src/database/migrations/`. Accessed via `strapi.db.connection`. Not exposed via Strapi's standard REST API; queried by custom controllers when the admin UI needs them.

### `strapi_forms_webhook_delivery_log`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (primary key) | Generated at insert |
| `webhook_config_id` | integer (foreign key → `webhook_configs.id`, cascade delete) | The config this attempt belongs to |
| `submission_id` | integer (foreign key → `submissions.id`, cascade delete) | The submission that triggered the attempt |
| `attempt_number` | integer (default 1) | 1, 2, 3, ... up to the configured retry cap |
| `status` | text | `pending` \| `success` \| `failed` \| `error` |
| `http_status` | integer (nullable) | HTTP response code, when one was received |
| `response_body_preview` | text (nullable) | First 1KB of response, for debugging |
| `error_message` | text (nullable) | When status = `error` (network failure, timeout, etc.) |
| `attempted_at` | timestamp with timezone | When the attempt was made |
| `duration_ms` | integer (nullable) | Round-trip time |

**Indexes**:
- `(webhook_config_id, attempted_at DESC)` — admin UI: "show recent deliveries for this webhook"
- `(submission_id)` — admin UI: "show delivery history for this submission"
- `attempted_at` — for retention pruning queries

### `strapi_forms_notification_delivery_log`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (primary key) | |
| `notification_rule_id` | integer (foreign key → `notification_rules.id`, cascade delete) | |
| `submission_id` | integer (foreign key → `submissions.id`, cascade delete) | |
| `recipients` | jsonb | Snapshot of who was emailed (in case the rule is later edited) |
| `status` | text | `success` \| `failed` |
| `error_message` | text (nullable) | Provider error, when applicable |
| `attempted_at` | timestamp with timezone | |

**Indexes**:
- `(notification_rule_id, attempted_at DESC)`
- `(submission_id)`
- `attempted_at`

**Retention**: no automatic pruning in v1 — flagged for v1.x or v2 once we have data on volume.

---

## 4. Custom field type registry

Mirrors Strapi's `customFields.register()` paradigm — two-sided registration, plugin-distributable.

### Server-side registration

```typescript
// In a host project's plugin server/register.ts:

export default ({ strapi }: { strapi: Strapi }) => {
  strapi.plugin('forms').service('fieldRegistry').register({
    name: 'address-autocomplete',           // unique identifier; becomes the field type's `type` value
    plugin: 'my-custom-fields-plugin',      // plugin id this field belongs to
    storageType: 'json',                    // underlying storage type for the value: 'string' | 'number' | 'boolean' | 'json'
    valueSchema: z.object({                 // Zod schema for the stored value
      formatted: z.string(),
      lat: z.number(),
      lng: z.number(),
      placeId: z.string(),
    }),
    configSchema: z.object({                // Zod schema for the field's editor configuration
      country: z.string().optional(),       // restrict to a country
    }),
    aiHint: 'A field for capturing a physical address with map autocomplete; stores formatted address and coordinates.',
    // aiHint is a one-sentence description the AI builder uses when deciding if this field type is appropriate
  });
};
```

### Admin-side registration

```typescript
// In a host project's plugin admin/src/index.tsx:

import AddressAutocompleteInput from './components/AddressAutocompleteInput';
import AddressAutocompleteConfig from './components/AddressAutocompleteConfig';
import AddressIcon from './components/AddressIcon';

export default {
  register(app: StrapiApp) {
    app.getPlugin('forms').registerFieldType({
      name: 'address-autocomplete',         // must match the server-side name
      intlLabel: { id: 'my-custom-fields-plugin.address-autocomplete.label', defaultMessage: 'Address' },
      icon: AddressIcon,
      Input: AddressAutocompleteInput,      // component shown to end users in the rendered form (admin preview only)
      ConfigPanel: AddressAutocompleteConfig, // component shown in the visual builder when configuring the field
    });
  },
};
```

### How it flows through the system

- When the plugin starts, `fieldRegistry` collects all registrations from all plugins. The core 12 field types are registered the same way at plugin bootstrap.
- The visual builder's field palette enumerates `fieldRegistry.list()` and renders one drag handle per field type.
- The AI builder's prompt includes the names + `aiHint` strings of all registered fields, so when a user says "add an address," the AI can pick `address-autocomplete` if it's available.
- The embed snippet does **not** receive custom-field components automatically — for v1, custom field types render in the admin only and submitted values pass through as opaque JSON. The embed snippet renders core types only. (Custom rendering on the public frontend is a stretch goal; for v1 devs handle custom-field rendering on the public site themselves, using the schema endpoint.)

---

## 5. Internal interfaces

### `AiProvider` interface

The thin abstraction over TanStack AI. Lives in `server/src/services/ai/`.

```typescript
export interface AiProvider {
  /**
   * Generate a complete form schema from a natural-language prompt.
   * Output is constrained to a valid FormSchema via Zod; invalid outputs are auto-retried up to 2x, then surfaced as an error.
   */
  generateForm(args: {
    prompt: string;
    availableFieldTypes: FieldTypeDescriptor[]; // names + aiHints from the registry
  }): Promise<FormSchema>;

  /**
   * Refine an existing form schema based on a natural-language instruction.
   * Examples: "add a phone field", "make the company field optional".
   */
  refineForm(args: {
    instruction: string;
    currentSchema: FormSchema;
    availableFieldTypes: FieldTypeDescriptor[];
  }): Promise<FormSchema>;

  /**
   * Health check — used at admin startup to display whether the configured provider is reachable.
   */
  healthCheck(): Promise<{ ok: boolean; error?: string }>;
}

interface FieldTypeDescriptor {
  name: string;
  aiHint: string;
}
```

**Implementations** (selected at bootstrap based on `ai_provider_configs.provider`):
- `AnthropicProvider`
- `OpenAIProvider`
- `OllamaProvider` (or any OpenAI-compatible local endpoint)
- `NoneProvider` — every method throws "AI builder is not configured"; the admin UI shows a setup prompt instead of a chat panel

### `WebhookDispatcher` interface

```typescript
export interface WebhookDispatcher {
  /**
   * Schedule a webhook delivery. May execute immediately (inline mode) or enqueue (BullMQ mode).
   */
  dispatch(args: {
    webhookConfigId: number;
    submissionId: number;
    payload: object;
  }): Promise<void>;

  /**
   * Returns recent delivery attempts for a webhook config.
   * Reads from strapi_forms_webhook_delivery_log.
   */
  getRecentDeliveries(args: {
    webhookConfigId: number;
    limit?: number;
  }): Promise<WebhookDeliveryLogEntry[]>;
}
```

**Implementations**:
- `BullMQDispatcher` — used when `STRAPI_FORMS_REDIS_URL` is set. Uses BullMQ's retry semantics (exponential backoff, configurable max attempts). Workers run in the same Strapi process; can be split into a separate worker process later.
- `InlineDispatcher` — used when Redis is not configured. Uses `setTimeout`-based retry with exponential backoff. Logs a warning at bootstrap that production deployments should configure Redis. Pending retries are lost on Strapi restart.

The interface is identical for both — the rest of the codebase doesn't know which is active.

### `FieldRegistry` service

```typescript
export interface FieldRegistry {
  register(descriptor: FieldTypeRegistration): void;
  list(): FieldTypeRegistration[];
  get(name: string): FieldTypeRegistration | undefined;
  /**
   * Validate a raw value against the field type's valueSchema.
   * Used at submission time and at form-schema-validation time.
   */
  validateValue(typeName: string, value: unknown): { ok: true; value: unknown } | { ok: false; errors: string[] };
}

export interface FieldTypeRegistration {
  name: string;
  plugin: string;
  storageType: 'string' | 'number' | 'boolean' | 'json';
  valueSchema: z.ZodSchema;
  configSchema: z.ZodSchema;
  aiHint: string;
}
```

The same registry instance serves the visual builder, the AI builder, and the submission validator.

### `FormSchemaValidator` service

A thin wrapper that combines the canonical `FormSchema` Zod schema with the field registry's per-type value schemas:

```typescript
export interface FormSchemaValidator {
  /** Validate the form definition itself. Called on form save. */
  validateSchema(schema: unknown): { ok: true; schema: FormSchema } | { ok: false; errors: ZodError };

  /** Validate submission data against the form's schema + registry. Called on submission. */
  validateSubmission(args: {
    schema: FormSchema;
    data: Record<string, unknown>;
  }): { ok: true; data: Record<string, unknown> } | { ok: false; errors: Record<string, string[]> };
}
```

---

## 6. REST API endpoints

Strapi auto-generates baseline CRUD for the content types; we customize and add explicit endpoints for the public surface and the admin-specific actions.

### Public endpoints (no auth required by default)

#### `GET /api/forms/:slug/schema`
Returns the canonical form schema for a published form, by its slug.

- **Auth**: public (unless the form's `authenticatedOnly` setting is true, then requires Strapi public token)
- **Response 200**:
  ```json
  {
    "schemaVersion": 1,
    "formId": "<documentId>",
    "slug": "contact",
    "schema": { /* FormSchema */ },
    "submissionUrl": "/api/forms/contact/submit"
  }
  ```
- **Response 404**: form not found or not published

#### `POST /api/forms/:slug/submit`
Accepts a submission to a published form.

- **Auth**: public (unless the form is `authenticatedOnly`)
- **Request**:
  ```json
  {
    "data": { "<fieldId>": "<value>", ... },
    "honeypot": "<honeypot field value, if present>"
  }
  ```
- **Response 201**:
  ```json
  { "submissionId": "<documentId>", "successMessage": "..." }
  ```
- **Response 400**: validation failed
  ```json
  { "errors": { "<fieldId>": ["error message", ...], ... } }
  ```
- **Response 404**: form not found
- **Side effects on success**: triggers all enabled `notification_rules` for the form (synchronously, errors logged not propagated), enqueues all enabled `webhook_configs` (via WebhookDispatcher).
- **Honeypot handling**: if the honeypot field is non-empty, submission is persisted with status `spam` and the response returns `201` with the success message anyway (so bots can't probe).

### Admin endpoints (require authenticated admin user with appropriate permissions)

These complement Strapi's auto-generated CRUD on the content types. Mostly the auto-generated endpoints suffice (`GET /forms-plugin/forms`, etc.); the ones below are custom.

#### `POST /forms-plugin/admin/forms/:documentId/duplicate`
Duplicate a form within the same project (free tier — Maya's Stage 2 cloning use case).

#### `GET /forms-plugin/admin/submissions/:formDocumentId/export.csv`
Export submissions as CSV. Supports query params: `status`, `from`, `to`, `q` (free-text search).

#### `POST /forms-plugin/admin/submissions/:documentId/status`
Update a submission's status. Body: `{ status: 'submitted' | 'read' | 'spam' }`.

#### `POST /forms-plugin/admin/ai/generate`
Generate a form schema from a natural-language prompt.

- **Request**: `{ prompt: string }`
- **Response 200**: `{ schema: FormSchema }` — the generated draft, ready to be opened in the visual builder
- **Response 400**: AI provider not configured, or AI failed to produce a valid schema after retries
- **Auth**: admin user with form-create permission

#### `POST /forms-plugin/admin/ai/refine`
Refine an existing schema with a natural-language instruction.

- **Request**: `{ instruction: string, currentSchema: FormSchema }`
- **Response 200**: `{ schema: FormSchema }`

#### `GET /forms-plugin/admin/ai/health`
Health check on the configured provider. Used in the admin UI to display whether AI is available.

#### `GET /forms-plugin/admin/forms/:documentId/copy-as-ai-prompt`
Returns a pre-built prompt string bundling the form's schema and instructions for an external LLM (Claude, Cursor, etc.) to generate a framework-native form component. The frontend "Copy" button just copies this string to the clipboard.

- **Response 200**: `{ prompt: string }`

#### `GET /forms-plugin/admin/webhooks/:configId/deliveries`
Returns recent webhook delivery log entries.

- **Response 200**: `{ deliveries: WebhookDeliveryLogEntry[] }`

#### `GET /forms-plugin/admin/notifications/:ruleId/deliveries`
Returns recent notification delivery log entries.

### Endpoints explicitly NOT exposed publicly

- All CRUD on `notification_rules`, `webhook_configs`, `ai_provider_configs` — admin only, never public.
- Direct CRUD on `submissions` — admin only (creation is via `/api/forms/:slug/submit`, not direct create).

---

## 7. Pages & key components (admin)

Lives in `admin/src/pages/`. Routes use Strapi v5's plugin routing.

### `/plugins/forms/forms`
**List view**. Table of all forms with search, status filter, "create new" button.
- Components: `FormsListTable`, `CreateFormButton`, `FormSearchBar`

### `/plugins/forms/forms/new`
**Form creation entry point**. Two paths visible:
- "Start from blank" → opens `/plugins/forms/forms/edit/<new-id>` with an empty form
- "Build with AI" → opens an AI chat panel (only visible when AI is configured)
- Components: `NewFormChooser`, `AiBuilderPanel`

### `/plugins/forms/forms/edit/:documentId`
**Visual builder**. The main form-editing surface.
- Layout: left sidebar (field palette), center canvas (the form being built), right sidebar (selected field's configuration panel, or form-wide settings when nothing is selected).
- Components: `FieldPalette`, `FormCanvas`, `FieldConfigPanel`, `FormSettingsPanel`, `AiBuilderPanel` (collapsible side-panel in this view too — for refining the existing form)
- Drag-and-drop: dnd-kit with `FieldPalette` items as draggables, `FormCanvas` as a sortable droppable.

### `/plugins/forms/submissions/:formDocumentId`
**Submissions inbox**. List of submissions for a single form.
- Components: `SubmissionsTable`, `SubmissionFilters`, `SubmissionDetailDrawer`, `BulkActionsBar`, `ExportCsvButton`
- Default filter: `status = submitted`. Tabs for `submitted` / `read` / `spam`. Free-text search across the JSON `data`.

### `/plugins/forms/forms/edit/:documentId/notifications`
**Notification rules** for the form. List + create/edit forms.

### `/plugins/forms/forms/edit/:documentId/webhooks`
**Webhook configs** for the form. List + create/edit forms. Includes per-webhook delivery log viewer.

### `/plugins/forms/settings`
**Plugin-wide settings**, accessed via Strapi's settings menu.
- AI provider configuration (provider, key, base URL, model)
- Default email-from address override (optional; falls back to Strapi's email plugin default)

### Cross-cutting components
- `AiBuilderPanel` — the chat surface used in both new-form creation and existing-form refinement
- `CopyAiPromptButton` — present on the form edit view, copies the schema-bundled prompt to clipboard

---

## 8. State management

Mostly handled by Strapi's admin patterns + React hooks. Specifically:

- **Server state**: `useFetchClient` (Strapi v5's data-fetching hook) for all admin reads/writes.
- **Form schema being edited**: a single React state object holding the current `FormSchema` draft. Edits go through a reducer to keep the schema valid at every step. Persists to the backend on explicit save (no autosave in v1).
- **AI chat history**: per-builder-session, stored in component state. Not persisted across page reloads in v1.
- **Field registry**: read once at admin startup via a dedicated endpoint, cached in a React context. Refreshed on Strapi restart (since registrations happen at server bootstrap).

---

## 9. Embed snippet architecture

Vanilla TS + Vite. Lives in a separate package (`@strapi-forms/embed` placeholder name).

### Public API

```html
<!-- Drop-in usage -->
<div data-strapi-form="contact"
     data-strapi-base-url="https://cms.example.com"></div>
<script src="https://cdn.example.com/strapi-forms-embed/v1/embed.iife.js"></script>
```

```typescript
// Programmatic usage (when imported as a module)
import { renderForm } from '@strapi-forms/embed';

const handle = renderForm({
  target: document.querySelector('#my-form')!,
  baseUrl: 'https://cms.example.com',
  slug: 'contact',
  onSubmit: (result) => { /* optional callback */ },
  onError: (error) => { /* optional callback */ },
});

handle.destroy(); // teardown
```

### CSS hook contract (stable, documented)

Every meaningful element gets a documented class name:
- `.sf-form` — the root form element
- `.sf-field` — wrapper for each field
- `.sf-field--<type>` — type-specific modifier (e.g., `.sf-field--email`)
- `.sf-field--invalid` — applied when the field has an error
- `.sf-label` — field label
- `.sf-input` — input element (input, textarea, select)
- `.sf-help` — help text
- `.sf-error` — field-level error message
- `.sf-submit` — submit button
- `.sf-success` — success message after submit
- `.sf-error-banner` — form-level error message

This contract is the public API of the embed snippet. Breaking it requires a major version bump.

### JS extension points

```typescript
renderForm({
  target,
  baseUrl,
  slug,
  hooks: {
    beforeSubmit: (data) => modifiedData,         // sync transform of the payload
    afterSubmit: (result) => void,                // post-success callback
    onValidationError: (errors) => void,
  },
  fieldRenderers: {
    'address-autocomplete': customRenderer,        // custom field type renderers
  },
});
```

### Bundle size budget

- Target: < 20KB gzipped for the IIFE bundle (ESM is similar). Hard ceiling: 30KB. CI enforces with bundlesize.

---

## 10. Background jobs / scheduled tasks

- **Webhook delivery worker** (BullMQ mode): consumes the webhook queue, executes delivery, writes to `strapi_forms_webhook_delivery_log`, retries per BullMQ semantics.
- **Notification dispatch**: synchronous in v1 (called inline from the submission handler). Easy to move to a queue later if it becomes a bottleneck.
- **No scheduled jobs in v1.** Log retention pruning, daily digests, etc. are all v2.

---

## 11. Environment variables

| Variable | Required | Purpose | Example |
|---|---|---|---|
| `STRAPI_FORMS_AI_PROVIDER` | No | Override the DB-stored AI provider | `anthropic` |
| `STRAPI_FORMS_AI_API_KEY` | No | Override the DB-stored AI key | `sk-ant-...` |
| `STRAPI_FORMS_AI_BASE_URL` | No | Override base URL (Ollama, self-hosted) | `http://localhost:11434/v1` |
| `STRAPI_FORMS_AI_MODEL` | No | Override the model | `claude-opus-4-7` |
| `STRAPI_FORMS_REDIS_URL` | No | When set, BullMQ webhook dispatcher is used. Unset = inline retry. | `redis://localhost:6379` |
| `STRAPI_FORMS_WEBHOOK_RETRY_MAX` | No | Maximum retry attempts for webhook delivery | `5` |
| `STRAPI_FORMS_WEBHOOK_HMAC_DEFAULT_SECRET` | No | Default HMAC secret applied if a webhook config has none set | `<random>` |

All env vars take precedence over their database-stored counterparts when set.

---

## 12. Validation flow summary

To make the validation responsibilities crystal clear:

| Action | What gets validated | Where |
|---|---|---|
| Save form (admin) | The form schema document conforms to `FormSchema` Zod | content-type lifecycle hook (`beforeCreate`/`beforeUpdate`) on `forms` |
| AI generates form | The AI's output conforms to `FormSchema` Zod | `AiProvider` implementation (auto-retry on invalid output) |
| Public submission arrives | Submission `data` conforms to the form's current schema and registered field types' value schemas | submission controller, before persisting |
| Webhook payload sent | Payload structure (we control this — tested at unit level) | n/a at runtime |
| Custom field type registered | The descriptor itself conforms to `FieldTypeRegistration` Zod | `fieldRegistry.register()` throws on invalid input |

The Zod schemas defined in section 1 are the source of truth at every layer.

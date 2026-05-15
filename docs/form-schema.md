# The canonical form schema

Every form is, at its core, a single JSON document conforming to the schema below. This document is the cross-package contract: the visual builder produces it, the admin API stores it, the public schema endpoint returns it, the embed snippet consumes it, and (Phase 2) the AI builder generates it.

## Top-level shape

```typescript
type FormSchema = {
  schemaVersion: 1;
  fields: Field[];     // min 1
  settings: FormSettings;
};
```

### `settings`

```typescript
type FormSettings = {
  submitButtonLabel: string;        // default 'Submit'
  successMessage: string;           // default 'Thank you for your submission.'
  errorMessage: string;             // default 'Something went wrong. Please try again.'
  redirectUrl?: string;             // optional URL to redirect to on success
  honeypotEnabled: boolean;         // default true
  authenticatedOnly: boolean;       // default false
};
```

## Fields

A `Field` is a discriminated union over the 12 core types (plus any custom types registered at runtime). Every field shares:

```typescript
type FieldBase = {
  id: string;                        // UUID — stable across edits
  label: string;                     // shown in the rendered form
  helpText?: string;
  placeholder?: string;
  defaultValue?: unknown;
  validations?: ValidationRule[];
};
```

### Core field types

| `type` | Type-specific properties | Storage |
|---|---|---|
| `text` | — | string |
| `textarea` | `rows: number` (default 4) | string |
| `email` | — | string (validated as email) |
| `number` | `step?: number` | number |
| `phone` | — | string |
| `url` | — | string (validated as http(s) URL) |
| `dropdown` | `options[]` **or** `optionsSource` (see below) | string |
| `radio` | `options[]` **or** `optionsSource` (see below) | string |
| `checkboxes` | `options[]` **or** `optionsSource` (see below) | array of strings |
| `date` | `min?: string`, `max?: string` (ISO) | string |
| `hidden` | `defaultValue: string` (required) | string |
| `content` | `html: string` | not user input — presentational |

### Collection-backed options (`optionsSource`)

`dropdown`, `radio`, and `checkboxes` can derive their choices from an
existing Strapi collection instead of hand-written `options`. Set
`optionsSource` on the field:

```typescript
type OptionsSource = {
  kind: 'collection';
  uid: string;          // collection UID, e.g. "api::product.product"
  labelField: string;   // attribute shown to the user, e.g. "title"
  valueField: string;   // attribute submitted (default "documentId")
};
```

```jsonc
{
  "type": "dropdown",
  "id": "…",
  "label": "Event",
  "optionsSource": {
    "kind": "collection",
    "uid": "api::event.event",
    "labelField": "title"
  }
}
```

- **Additive, not exclusive.** Static `options` still works exactly as
  before. A field uses `optionsSource` only when it's present.
- **Resolved at read time.** `GET /api/forms/:slug/schema` queries the
  referenced collection and projects each row to `{ label, value }`,
  substituting into `options` before the response is sent. The embed and
  submit endpoint both see the resolved list, so choices stay in sync
  with your data with no rebuild.
- **`valueField` defaults to `documentId`** — the stable, D&P-safe
  identifier. Override it only if you need a different attribute as the
  submitted value.
- Drafts may have neither `options` nor `optionsSource` while you're
  mid-edit; publish-time validation enforces that a choice field has one
  or the other.

The AI builder can set this up for you — see
[ai-builder.md](ai-builder.md#pointing-fields-at-your-collections).

### `validations`

Discriminated on `kind`:

```typescript
type ValidationRule =
  | { kind: 'required'; message?: string }
  | { kind: 'minLength'; value: number; message?: string }
  | { kind: 'maxLength'; value: number; message?: string }
  | { kind: 'min'; value: number; message?: string }
  | { kind: 'max'; value: number; message?: string }
  | { kind: 'pattern'; regex: string; message?: string }
  | { kind: 'email'; message?: string }
  | { kind: 'url'; message?: string };
```

A `message` overrides the default error string for the field.

## Where the schema is the contract

| Surface | Reads | Writes |
|---|---|---|
| Visual builder UI | yes (load) | yes (save) |
| `GET /api/forms/:slug/schema` | yes | — |
| `POST /api/forms/:slug/submit` | yes (validates submission against it) | — |
| Embed snippet | yes (renders + validates) | — |
| AI builder (Phase 2) | yes (refines) | yes (generates) |
| Custom field type registry | extends the union at runtime | — |

## Versioning

`schemaVersion: 1` is the v1 contract. Additive changes (new optional fields, new validation kinds, new field types in the registry) do not bump it. Breaking changes (rename, remove, semantic change) bump it; old forms migrate forward.

## Field IDs are stable

Every field has a UUID `id` that survives label changes. Submissions are stored against `id`, so you can rename a label without invalidating any historical data.

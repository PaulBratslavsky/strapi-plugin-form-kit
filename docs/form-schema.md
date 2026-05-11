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
| `dropdown` | `options: { label, value }[]` | string |
| `radio` | `options: { label, value }[]` | string |
| `checkboxes` | `options: { label, value }[]` | array of strings |
| `date` | `min?: string`, `max?: string` (ISO) | string |
| `hidden` | `defaultValue: string` (required) | string |
| `content` | `html: string` | not user input — presentational |

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

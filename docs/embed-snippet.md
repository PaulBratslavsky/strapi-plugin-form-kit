# `@strapi-forms/embed` — the embed snippet

A < 5 KB gzipped, dependency-free script that turns any form built in Strapi Forms into a working frontend. Three deploy shapes — pick whichever fits your stack. All three are powered by your Strapi instance directly; no npm publish, no CDN required.

## 1. Drop-in script (recommended)

```html
<div data-strapi-form="contact"></div>
<script src="https://cms.example.com/api/forms/embed.js"></script>
```

The bundle is served by the plugin itself at `/api/forms/embed.js`. It auto-detects the Strapi origin from its own script URL, so the snippet doesn't need a `data-strapi-base-url` attribute. Multiple forms per page are fine — the runtime scans for every `[data-strapi-form]` on `DOMContentLoaded`.

Use `data-strapi-base-url` only when you're hosting the bundle from a different origin than the API (rare).

## 2. Iframe

```html
<iframe src="https://cms.example.com/api/forms/contact/embed"
        style="border:0;width:100%;min-height:600px"
        title="Contact form"></iframe>
```

Renders the form in a self-contained HTML page served by `GET /api/forms/:slug/embed`. Best for no-code sites (Webflow, WordPress, Notion) and full CSS isolation from the host page.

## 3. Direct link

```
https://cms.example.com/api/forms/contact/embed
```

Same hosted page as the iframe — usable as a standalone URL. Includes OG/Twitter meta tags so it renders nicely when pasted into Slack, Twitter, etc.

## When to use which

| Use this | When you want |
|---|---|
| Script | Inline in your existing site, native styling, minimal isolation |
| Iframe | Full CSS isolation, paste into a CMS that filters scripts |
| Direct link | Share by URL — email, Twitter, Slack |
| Programmatic (below) | Total control inside a React/Vue/etc. app |

## Programmatic usage

```ts
import { renderForm } from '@strapi-forms/embed';

const handle = await renderForm({
  target: document.querySelector('#my-form')!,
  baseUrl: 'https://cms.example.com',
  slug: 'contact',
  hooks: {
    beforeSubmit: (data) => ({ ...data, source: 'landing-page' }),
    afterSubmit: ({ submissionId, successMessage }) => console.log('saved', submissionId),
    onValidationError: (errors) => console.warn(errors),
  },
  fieldRenderers: {
    'address-autocomplete': (args) => { /* custom DOM render */ },
  },
});

handle.destroy(); // remove listeners and clear the target
```

## CSS hook contract

These class names are **public API**. Breaking them requires a major version bump.

| Class | Element |
|---|---|
| `.sf-form` | the root `<form>` |
| `.sf-field` | wrapper for each field |
| `.sf-field--<type>` | type-specific modifier (`.sf-field--email`) |
| `.sf-field--invalid` | applied while a field has an error |
| `.sf-label` | field label |
| `.sf-required-mark` | the `*` after a required field's label |
| `.sf-input` | input / textarea / select element |
| `.sf-help` | help text |
| `.sf-error` | per-field error message |
| `.sf-error-banner` | form-level error message |
| `.sf-success` | success message rendered after a successful submit |
| `.sf-submit` | submit button |
| `.sf-radio-group`, `.sf-radio` | radio button group + each option |
| `.sf-checkbox-group`, `.sf-checkbox` | checkbox group + each option |
| `.sf-honeypot` | the hidden anti-spam field |
| `.sf-content` | wrapper around `content`-type field HTML |

You can fully restyle the form using only these classes — no JS changes, no forking.

## JS extension points

```ts
type RenderFormHooks = {
  beforeSubmit?: (data) => data | Promise<data>;
  afterSubmit?: ({ submissionId, successMessage }) => void;
  onValidationError?: (errors) => void;
};

type FieldRenderer = (args: {
  field: Field;
  fieldEl: HTMLElement;     // the .sf-field wrapper to mount into
  inputId: string;          // unique id you can put on your input
  setValue: (v: unknown) => void;   // call this whenever the value changes
  initialValue: unknown;
}) => void;
```

`fieldRenderers` lets host projects render custom field types without forking the snippet.

## Bundle size

CI enforces:
- target: < 20 KB gzipped (warn if exceeded)
- ceiling: 30 KB gzipped (fail)

Current size is ~3.5 KB gzipped.

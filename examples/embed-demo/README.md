# `embed-demo`

A minimal Vite frontend for testing `@strapi-forms/embed` against a local
Strapi instance. Useful for sanity-checking that a form built in the admin
actually renders + submits on a third-party page (CSS, validation, hooks
all work).

## Usage

```bash
# from the repo root, Strapi must be running on :1337
pnpm -F embed-demo dev
```

Opens http://127.0.0.1:5174. Pick a published form slug, or "Enter manually."

## Environment

```bash
# examples/embed-demo/.env.local
VITE_STRAPI_URL=http://localhost:1337
VITE_FORM_SLUGS=contact,signup       # comma-separated, seeds the dropdown
```

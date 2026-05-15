# Changelog

All notable changes to **`strapi-plugin-form-kit`** are documented here. The format
is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.4.1] — 2026-05-15
### Fixed
- **Style AI can now darken input fields.** Added an `inputBackgroundColor`
  vocabulary key wired to `--sf-input-bg` across the loose style schema,
  normaliser, prompt, and both (admin + embed) theme resolvers. Prompts
  like *"dark inputs, high-contrast text"* / *"make it dark mode"* now
  darken the field boxes instead of leaving them the preset's light fill.

### Changed
- Internal decomposition pass (no behavior change): split the monolithic
  `admin/src/api.ts` into a per-domain `api/` module, extracted
  `FormBuilder` styled-components, split the `public-form` controller into
  `public-form` + `public-embed` with a shared `form-lookup` helper, and
  exported `resolveOneOptionSource` for direct reuse.
- Added vitest coverage for `retry`, `sse`, and `options-source-resolver`
  (19 tests; suite now 86).

### Documentation
- Documented collection-backed options (`optionsSource`) in the form
  schema reference, AI builder guide, and getting-started.
- Added a `docs/` index; README now links docs via absolute URLs (so
  they resolve on npmjs.com) and carries an early-alpha notice +
  Contributing section.

## [0.4.0] — 2026-05-14
### Added
- **AI is now aware of available collections.** The system prompt advertises
  every `api::*` / `plugin::*` collection type with its string attributes.
  Prompts like *"event picker from our Events collection"* now produce a
  dropdown with `optionsSource` instead of inventing static options.
- Loose-schema (`loose-schema.ts`) accepts an `optionsSource` shape on
  choice fields. Normaliser (`normalize.ts`) passes it through and skips
  static-option synthesis when present.
- New admin endpoint `POST /forms-plugin/admin/resolve-options-source` —
  resolves a single source on demand. Powers the Preview & test modal so
  the in-modal render shows the exact options the live form will see.
- `FormPreview.tsx` calls the resolver for each `optionsSource` field and
  caches by `(uid, labelField, valueField)`. Live updates as the picker
  config changes; no save needed.

### Changed
- Choice field `options` is now `optional` (was `min(1)`). Drafts may save
  with empty options arrays while the admin is mid-edit. Publish-time
  enforcement is a future TODO.
- Switching the "From collection" toggle off seeds one starter option so
  the dropdown isn't a confusing blank state.
- New callout in the collection picker explains the access model — options
  are resolved server-side, no public read access required.

### Fixed
- Toggling "From collection" on now clears stale static `options`. Without
  this, the editor state (and Preview & test modal) kept rendering "Option
  1 / Option 2" even after the toggle was active.

## [0.3.0] — 2026-05-14
### Added
- **Per-IP rate limiting on `POST /api/forms/:slug/submit`**. Default 10
  submissions per minute per (IP, slug) tuple. Configurable via plugin
  config (`submitRateLimit.{enabled,windowMs,max}`) or env vars
  (`STRAPI_FORMS_RATELIMIT_*`). Emits `X-RateLimit-*` and `Retry-After`
  response headers; returns HTTP 429 when exceeded. Lives in
  `server/src/middlewares/submit-rate-limit.ts`.
- **`matchField` validation rule** for cross-field equality (confirm
  password / confirm email). Stores the id of another field whose value
  must match.
- **AI test coverage** — 44 new tests across `normalize.test.ts`,
  `parse.test.ts`, and `mock.test.ts`. Covers type aliases, label
  derivation, validation building, choice option synthesis, fence
  stripping, brace carving, named-color resolution, mock streaming.
- **CHANGELOG.md** following the Keep a Changelog format.
- **GitHub Actions release workflow** (`.github/workflows/release.yml`).
  Tag-triggered (`v0.3.0`) or manual-dispatch publishes to npm.
- **Dependabot config** (`.github/dependabot.yml`) — weekly grouped
  updates per workspace package.

## [0.2.1] — 2026-05-13
### Fixed
- Repository URLs in `package.json` now point at the canonical GitHub repo
  (`strapi-plugin-form-kit`). Previous metadata 404'd from npm link-outs.

## [0.2.0] — 2026-05-12
### Added
- **Collection-backed choice options** for `dropdown` / `radio` / `checkboxes`
  fields. Toggle "From collection" in the field config, pick a Strapi content
  type and label attribute. Server resolves options at `/schema` read time;
  embed sees a normal `{ options: [{ label, value }] }` array.
- New `GET /forms-plugin/admin/content-types` endpoint enumerates collection
  types eligible for the picker, including each type's string attributes.
- New `services/options-source-resolver.ts` walks a schema and substitutes
  resolved options into fields. Soft-fails on lookup errors.

## [0.1.1] — 2026-05-11
### Fixed
- **AI style colour validation is now permissive.** Small local models
  (Ollama / gemma4) emit colour names outside our 19-name palette
  ("navy", "darkblue", "light"). Previously the strict Zod enum rejected
  these, the harness retried 3× with error feedback, and the user saw
  `ollama produced invalid output after 3 attempts: backgroundColor: Invalid`.
  Schema now accepts any string; normaliser silently drops unknowns.
- Expanded `NAMED_COLORS` map with 25+ common CSS / Tailwind names and
  modifier stripping ("soft-rose" → "rose").

## [0.1.0] — 2026-05-11
### Added
- Initial public release as `strapi-plugin-form-kit`.
- **Drag-and-drop form builder** in the Strapi admin (12 core field types,
  registry for custom types from host projects).
- **AI form builder** — describe a form in English; Claude / GPT / local
  Ollama drafts it. BYOK, encrypted at rest. Streaming UI with live field
  cards. Loose-schema harness so 8B-param models work reliably.
- **Style mode** — visual customisation per form (4 themes, per-field
  overrides, "I'm feeling lucky" random vibe picker, AI-driven styling).
- **Submissions inbox** with filters, search, bulk actions, CSV export.
- **Email notifications** with Liquid templates and per-form rules.
- **Webhooks** with HMAC signing, retries (BullMQ when Redis is set; inline
  fallback otherwise), and a delivery audit log.
- **Three deploy shapes** for embedding: script tag, iframe, direct link.
  All served by the plugin itself at `/api/forms/embed.js` and
  `/api/forms/:slug/embed` — no separate npm package or CDN required.
- **Headless API** — `GET /api/forms/:slug/schema` + `POST /api/forms/:slug/submit`.
- **ETag-based schema revalidation** — republished forms reflect on the next
  page load with no manual cache invalidation.

[Unreleased]: https://github.com/PaulBratslavsky/strapi-plugin-form-kit/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/PaulBratslavsky/strapi-plugin-form-kit/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/PaulBratslavsky/strapi-plugin-form-kit/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/PaulBratslavsky/strapi-plugin-form-kit/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/PaulBratslavsky/strapi-plugin-form-kit/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/PaulBratslavsky/strapi-plugin-form-kit/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/PaulBratslavsky/strapi-plugin-form-kit/releases/tag/v0.1.0

# Functional Requirements

## Scope philosophy

This is a **bootstrapped, freemium MVP**. The free tier ships first and must be genuinely useful on its own — it is the open-source plugin that gets installed via Strapi's marketplace. The Pro tier ships shortly after (or alongside) and unlocks features agencies and growing teams will pay for.

We are explicitly **not** trying to match WPForms feature parity on day one. We are trying to ship a focused, high-quality v1 that does the 80% case excellently — contact forms, lead-gen forms, newsletter signups — and leaves room for paid expansion.

Requirements are written as **capability statements** — what the product must do, not how it does it. Tech choices come in Stage 4.

## Foundational principle: schema-first architecture

Every form in this plugin is, at its core, a **canonical JSON schema representation** stored as a row in a Strapi `forms` collection. This schema is the single source of truth. All authoring surfaces — visual builder, AI chat builder, future MCP server, programmatic dev definitions — are different ways of producing or modifying the *same* artifact.

This is a deliberate, foundational design choice and it carries through every other requirement below. The implications:

- **Multiple authoring surfaces are first-class, not retrofitted.** Visual drag-and-drop is one way to build a form. Natural-language chat is another. Defining the form in code is another. They all converge on the same schema.
- **Field types are a registry, not a fixed list.** The plugin ships a core set of field types, and developers must be able to register custom field types from outside the plugin. The visual builder, AI builder, and any future MCP surface all enumerate available field types from this registry.
- **Forms-as-data, not forms-as-config.** Because forms live in a Strapi collection, they are queryable via Strapi's standard APIs (REST + GraphQL), exportable, version-controllable in code, and accessible to any external system that talks to Strapi.
- **The schema must be stable and documented.** It is effectively a public API. Breaking changes to the schema shape would break the visual builder, the AI builder, custom field types, and (eventually) the MCP server simultaneously.

This principle is what makes the AI builder, MCP plans, and developer extensibility coherent rather than three separate add-on systems.

---

## Core features (Free MVP)

### Form building
- Users must be able to create a new form from inside the Strapi admin without writing code.
- Users must be able to add, remove, and reorder fields via drag-and-drop.
- Users must be able to configure each field's label, placeholder, help text, default value, and required/optional state.
- Users must be able to preview a form before publishing.
- Users must be able to save a form as a draft and publish/unpublish it.
- Users must be able to duplicate an existing form within the same Strapi project as a starting point for a new one.
- The visual builder must read and write the canonical form schema (per the schema-first principle). Any change made in the builder is reflected in the underlying schema, and any schema written by another surface (AI, code) must be openable and editable in the visual builder.

### AI chat form builder (free tier, bring-your-own-AI)
- Users must be able to describe a form in natural language ("a contact form with name, email, and a dropdown for inquiry type") and have the plugin generate a draft form schema.
- Users must be able to refine an existing form via chat ("add a phone field, make the company field optional").
- The plugin must support **bring-your-own AI** — users configure the plugin with their own API key (Anthropic, OpenAI, etc.) or point it at a local model (Ollama, LM Studio, or any OpenAI-compatible local endpoint). The plugin itself does not bundle or pay for AI inference.
- The plugin must use a **provider abstraction** so adding a new AI provider does not require changes to the chat UI. (Implementation: see Stage 4 — likely Vercel AI SDK or similar.)
- The AI must only output valid form schemas conforming to the canonical schema definition. Invalid output must be caught and either auto-corrected or surfaced as a "regenerate" prompt — never silently accepted.
- AI-generated forms land in the visual builder where the user can review and tweak before publishing.

### Field type registry (free tier, extensible)
- The plugin must ship a registry of core field types (listed below).
- Developers must be able to register **custom field types** from their own Strapi project code, without forking the plugin.
- A custom field type registers: a unique type identifier, a configuration schema (what options the field exposes in the builder), a render hint for the embed snippet, and validation rules.
- The visual builder, AI chat builder, and embed snippet must all enumerate field types from this registry — so a registered custom field is automatically available everywhere.

### Core field types (free tier, registered in the field registry)
The plugin must ship the following field types out of the box. All are registered through the same registry mechanism that custom field types use — meaning the core set is defined the same way as user-defined types, ensuring consistency.
- Single-line text
- Multi-line text (textarea)
- Email
- Number
- Phone
- URL
- Dropdown (single select)
- Radio buttons (single select)
- Checkboxes (multi-select)
- Date
- Hidden field (for tracking source, campaign, etc.)
- HTML/content block (for instructions or section headers between fields)

### Submissions
- Submissions must be stored inside Strapi alongside the rest of the project's data.
- Users must be able to see a list of submissions for each form, with submission date, source (form name), and a preview of key fields.
- Users must be able to open an individual submission and view all field values.
- Users must be able to search submissions by free text.
- Users must be able to filter submissions by form, date range, and status (read/unread).
- Users must be able to mark submissions as read/unread.
- Users must be able to delete individual submissions.
- Users must be able to export submissions to CSV (per form or filtered set).

### Notifications
- Users must be able to configure one or more email notification rules per form (e.g., "send to sales@... when this form is submitted").
- Notifications must include the submitted field values in the email body.
- Users must be able to customize the notification subject line and add static text to the body.
- Failed notifications must be logged and visible in the admin (so a misconfigured SMTP doesn't silently drop leads).

### Webhooks
- Users must be able to configure one or more outgoing webhooks per form.
- The webhook payload must include all submitted field values plus form metadata (form ID, submission ID, timestamp).
- Webhook delivery must be retried on transient failure (with a sensible cap).
- Webhook delivery history must be visible in the admin per form.

### Embedding & API — the layered consumption model

The plugin treats form **consumption on the frontend** as a progressive enhancement stack. The schema is the canonical contract at every layer; the embed snippet, AI-assisted customization, and (eventually) the SDK are all separate artifacts that sit on top of it.

**Layer 1 — The schema (canonical artifact, free tier)**
- Each published form must expose a public API endpoint that returns the canonical form schema (fields, validation rules, settings).
- The schema must be stable, documented, and designed to be both human- and LLM-readable.
- Each form must expose a public API endpoint that accepts submissions, validates input against the schema, and returns field-level errors on rejection.

**Layer 2 — Embed snippet (free tier, ships in v1)**
- The plugin must ship a small (~20KB target, gzipped) framework-agnostic JavaScript embed snippet — published as its own npm package and available via CDN — that takes a form schema and renders a working HTML form.
- The snippet must be droppable into any HTML page via a `<script>` tag plus a target element (e.g., `<div data-strapi-form="contact">`). No build step required.
- The snippet must handle client-side validation against the schema, submission to the Strapi endpoint, success/error states, and basic accessibility (proper labels, ARIA attributes, keyboard navigation).
- The snippet must expose **stable CSS hooks** (documented class names on every meaningful element — field wrappers, inputs, labels, error messages, submit button) so users can fully restyle it without touching JavaScript. This is essential to the customization story below.
- The snippet must expose **JS extension points** for advanced cases — pre-submit hooks, custom field renderers per field type, post-submit callbacks — so devs who want to keep using the snippet but tweak behavior can do so without forking.
- The snippet must remain framework-agnostic. No React, Vue, or framework dependencies in the public bundle.
- The snippet is **not** marketed as "the SDK." It is the embed snippet. The SDK is a separate, future v2 package (see Layer 4).

**Layer 3 — Customization via LLM (free tier, supported by docs and an admin affordance)**
- The embed snippet's CSS hooks must be documented in a way that's directly pasteable into an LLM prompt — i.e., users can ask Claude/Cursor "write Tailwind CSS matching my brand for these class names" and get usable output.
- The plugin must include a **"Copy as AI prompt" action** in the admin form view: a one-click action that copies the form's schema bundled with a pre-written instruction (e.g., "Build a React form component for this Strapi form schema using Tailwind. Form posts to {URL}. Handle validation client-side. Schema: {...}") to the clipboard. This is an admin UI feature inside the plugin — not a separate package.
- For users who want full custom control, the raw schema endpoint (Layer 1) is sufficient — they fetch it directly and use any LLM or hand-write their renderer.

**Layer 4 — TypeScript SDK (deferred to v2, separate package)**
- A full TypeScript SDK with framework-specific bindings (React, Vue, Astro, etc.), generated types, and production-grade DX is **explicitly out of scope for v1**. It will ship as a **separate, distinctly-named npm package** in v2 — not as a major version of the embed snippet.
- This separation follows the pattern used by mature ecosystems (Stripe ships `stripe.js` and `@stripe/react-stripe-js` as separate artifacts; Auth0 ships `auth0.js` and `@auth0/auth0-react` similarly). Each package is honest about what it is and who it serves.
- Rationale for deferring to v2: in v1 we don't yet know if the audience is overwhelmingly Next.js, evenly split across frameworks, or dominated by edge cases like Astro/Remix. The embed snippet + LLM-augmented customization handles every case adequately in v1, and the SDK can be designed properly in v2 once we have data.

### Embed support inside Strapi (free tier)
- Forms must be referenceable as Strapi components/dynamic-zone-friendly entries so a Strapi page that uses dynamic zones (the typical CMS pattern) can include "this form" as one of its blocks. This means Maya can build a landing page in Strapi, drop a "Form" block in, pick which form, and the frontend (when consuming the page via Strapi's API) gets the form schema as part of the page data.

### Artifact summary (v1 vs. later)
| Artifact | What it is | Ships when |
|---|---|---|
| `strapi-plugin-forms` (placeholder name) | The Strapi plugin: admin UI, visual builder, AI chat builder, submissions, notifications, webhooks, custom field type registry, "Copy as AI prompt" admin action | v1 (free) |
| Embed snippet (placeholder name, e.g. `@strapi-forms/embed`) | The ~20KB vanilla-JS renderer with CSS hooks and JS extension points; published as npm + CDN | v1 (free) |
| TypeScript SDK | Typed, framework-native (React/Vue/Astro) bindings; separate package | v2 |
| MCP server | Exposes form-authoring to Claude Desktop and other MCP clients via the canonical schema | Pro phase 2 |

### Spam protection (free tier)
- Forms must include a honeypot field by default (invisible to humans, populated by bots).
- Submissions failing the honeypot must be silently rejected (no error returned to the bot).

### Permissions
- Strapi's existing role/permission system must control who can create forms, view submissions, edit forms, and configure notifications/webhooks.
- A "client editor" role pattern must be supported so an agency can hand off a project with the client able to view submissions and edit forms but not, e.g., delete forms entirely.

---

## Core features (Pro tier — sells alongside or shortly after free MVP)

These are explicitly **not in the free tier**. They are the paid hook.

- **Conditional logic** — show/hide fields and pages based on the value of other fields.
- **Multi-step forms** — split a form across multiple pages with progress indication.
- **File uploads** — accept file submissions (with size and type limits).
- **Advanced spam protection** — reCAPTCHA, hCaptcha, and similar third-party verification.
- **Form templates library** — a curated set of pre-built templates (contact, newsletter, lead-gen, RFQ, event RSVP, etc.) that can be installed into a project as a starting form.
- **Cross-project cloning / blueprints** — agency users can save a form as a reusable blueprint and apply it to a different Strapi project (the Maya use case).
- **Native integrations** — Mailchimp, HubSpot, Slack, Zapier connector. Each is a discrete add-on or bundle.
- **Submission status workflow** — beyond read/unread, allow custom statuses (new, qualified, contacted, archived) with optional automation triggers.
- **MCP server** (later Pro phase) — the plugin exposes its form-building capabilities via the Model Context Protocol, so users can build, edit, and inspect forms from Claude Desktop, Claude Code, or any MCP-compatible client without ever opening the Strapi admin. This is the natural extension of the schema-first architecture: the MCP server is just another authoring surface over the canonical schema.

---

## Account & auth

- The plugin uses **Strapi's existing authentication and user system** — there is no separate plugin login or account.
- All admin actions (build forms, view submissions, configure notifications) require a logged-in Strapi admin user with appropriate permissions.
- The public-facing form submission endpoint is unauthenticated by default (forms must be fillable by anonymous site visitors).
- Optional: forms can be marked as "authenticated only," requiring a Strapi public API token or end-user auth, for cases where forms live behind a login.

---

## Data the product handles

At the conceptual level, the plugin introduces these entities into a Strapi project:

- **Form** — a configured form, stored as a row in a Strapi `forms` collection. Holds the canonical schema (fields, settings, conditional logic, etc.) plus name, slug, draft/published state, and ownership/permission scope.
- **Field schema** (within a Form) — a single input definition: type identifier (referencing the field type registry), label, validation rules, required/optional, conditional logic (Pro), and ordering. Stored as part of the Form's schema, not as separate rows.
- **Field type registry** — runtime metadata about available field types (core + custom). Not user-edited data; populated at plugin startup from the core set plus any custom types registered by the host project.
- **Submission** — one entry submitted to a form. Contains the field values, submission timestamp, source metadata (referrer, IP for spam tracking), and read/unread status.
- **Notification rule** — an email configuration attached to a form: recipient(s), subject, body template, trigger conditions.
- **Webhook config** — an outgoing webhook attached to a form: URL, optional headers, secret for signing.
- **Notification log / Webhook delivery log** — historical record of attempted notifications and webhook deliveries, including success/failure status.
- **AI provider config** — per-instance configuration for the AI chat builder: which provider (Anthropic, OpenAI, local/Ollama, etc.), API key (stored securely), model name, optional base URL for local/self-hosted endpoints.
- **Form template / Blueprint** (Pro) — a saved form definition that can be applied to other projects.

Note: these are conceptual entities. Concrete schemas, fields, and types are defined in Stage 5. Stage 5 is also where we formalize the canonical form schema itself — this is the most important artifact in the whole product and deserves its own dedicated section there.

---

## Integrations

### Free MVP
- **Outgoing email** — the product must be able to send notification emails via whatever email provider Strapi is configured with (SMTP, SendGrid, etc. — not a separate integration choice).
- **Outgoing webhooks** — generic HTTP POST to a user-configured URL with the submission payload.

### Pro
- **Mailchimp** — push subscribers from form submissions into a Mailchimp audience.
- **HubSpot** — create contacts/leads in HubSpot from submissions.
- **Slack** — post submission notifications to a Slack channel.
- **Zapier connector** — a public Zapier integration that exposes "new submission" as a trigger.

(All Pro integrations are out of scope for the free MVP. Webhooks cover them as a workaround.)

---

## Non-functional requirements

- **Performance**: the plugin must not measurably degrade the performance of the Strapi admin or the public Strapi API for non-form requests. The plugin's frontend rendering snippet must be small (target: under a few hundred KB gzipped, no heavy framework dependencies on the public site).
- **Scale (MVP assumption)**: a typical project will have 5–50 forms and accumulate up to ~10,000 submissions per form. The product must perform well under those volumes; higher-volume scenarios are not an MVP requirement but should not be architecturally precluded.
- **Reliability**: notification and webhook delivery must be retried on transient failure. The submissions list must remain responsive even with thousands of entries (pagination, indexed queries).
- **Security**: submission endpoints must validate input on the server side regardless of client validation. Webhook payloads must support optional HMAC signing so receivers can verify authenticity. No personal data leaves the Strapi instance unless the user has explicitly configured a notification or webhook to send it there.
- **Compliance**: deferred for MVP per the user's "ship and learn" choice. Will be revisited based on real customer demand (likely GDPR first, given European agency use).
- **Compatibility**: must work with current major Strapi versions (concrete version range decided in Stage 4). Must not require any specific database (Strapi supports SQLite/Postgres/MySQL — the plugin should be database-agnostic at the schema level).

---

## Out of scope for MVP

These are explicitly deferred. Listing them prevents scope creep and gives a clear signal to early users.

### Deferred to Pro (post-free-MVP)
- Conditional logic
- Multi-step forms
- File uploads
- Form templates library and cross-project cloning
- Native CRM/marketing integrations
- Advanced spam protection (reCAPTCHA, hCaptcha)
- Custom submission statuses
- MCP server (later Pro phase — exposes form building to Claude Desktop and other MCP clients)

### Deferred to v2 (not even in initial Pro)
- **TypeScript SDK with framework-specific bindings** (React, Vue, Astro, etc.) — Layer 4 of the consumption model. Ships as a separate, distinctly-named npm package, deferred until v1 usage data shows which frameworks to prioritize.
- Payments (Stripe/PayPal/Square integrations)
- Calculation fields (e.g., quote calculators)
- E-signatures
- Conversational / Typeform-style one-question-at-a-time forms
- Surveys, polls, quizzes as dedicated form types
- User registration forms (creating Strapi users from a submission)
- Post submission (creating Strapi content entries from a submission)
- A/B testing of forms
- Submission analytics dashboards beyond CSV export
- Internationalization of the form-rendering frontend
- GDPR-specific tooling (consent fields, data retention, right-to-be-forgotten)

(Note: AI form builder is **not** deferred — it ships in the free MVP via bring-your-own-key/local-LLM. It is a core differentiator, not a v2 feature.)

---

## Acceptance criteria for the free MVP

The free MVP is "done" when:

- An agency PM can install the plugin from Strapi's marketplace, build a contact form via drag-and-drop in under 5 minutes, and embed it on any HTML page (including Next.js, plain HTML, Webflow embed) using the embed snippet with a 2-line script tag — no developer required for the embed step.
- A user can configure an AI provider (their own Claude/OpenAI key, or a local Ollama endpoint), describe a form in natural language ("a lead-gen form with name, email, company, and a dropdown for company size"), and have a working draft form generated and openable in the visual builder.
- A developer can register a custom field type from their host Strapi project code, and that field type appears in both the visual builder's field palette and the AI builder's available types.
- A developer can use the "Copy as AI prompt" action in the admin to get a Claude-ready prompt, paste it into Claude/Cursor, and receive a working framework-native (e.g., React + Tailwind) form component for the form they built.
- A developer can fully restyle the embed snippet to match a custom design system using only the documented CSS hooks — no JavaScript changes, no forking the snippet.
- A client marketer can log into Strapi, see a new submission to that form, view its details, mark it read, and export a CSV of all submissions.
- An email notification fires reliably to a configured address when a form is submitted.
- A webhook fires reliably to a configured URL when a form is submitted.
- A developer can read the plugin docs and configure a form's submission endpoint to be called from a custom frontend without surprises.
- The plugin passes a basic load test (1,000 submissions to a single form, list view stays responsive).
- The plugin works on the major Strapi versions targeted in Stage 4, on at least Postgres and SQLite.
- The canonical form schema is documented as a public API artifact (so custom field types, the AI builder, the embed snippet, the LLM-prompt helpers, and future MCP/SDK integrations all have a stable contract to build against).

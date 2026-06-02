# Analytics — planning doc

Captures the research, architectural decisions, and scope phasing for the
form analytics dashboard. v1 ships the universal funnel; everything else
is roadmap.

> **Status**: v1 implementation in progress (`feat/analytics-v1`). Decisions
> §7 signed off 2026-06-01; open questions §9 resolved (see inline). Spec
> drafted 2026-05-14.

---

## 1. Goals

A "did my form work?" dashboard that answers three questions per form:

1. **How many people saw it?** (views)
2. **Of those, how many tried?** (starts)
3. **Of those, how many succeeded?** (submissions — and where did the rest drop off?)

Constraints:

- **Privacy-first by default** — no cookies, no PII, no cross-device tracking. EU-defensible without a separate consent banner.
- **Self-hosted** — data lives in the user's Strapi DB. Never leaves their stack. This is a marketing differentiator (every competitor is SaaS).
- **Cheap to run** — table stakes for evaluators and hobbyists. Sampling / hard caps so a viral form doesn't bury the DB.

---

## 2. Competitive research — what others do

Research pass (2026-05-14) covered Typeform, HubSpot Forms, Tally, Fillout, Jotform. Full notes in commit history; condensed:

**Universal table stakes across all five**: views, starts, submissions, completion rate, average time to complete, daily time-series chart, segmentation by device/source/geo, 7/30/90d date ranges, CSV export of submissions.

**Per-player highlights**:

- **Typeform** — gold standard for per-question drop-off. Events surfaced via their embed library: `onReady`, `onStarted`, `onQuestionChanged`, `onSubmit`. Drop-off is reversible (returning sessions decrement old drop-off).
- **HubSpot** — enterprise view, but no per-field drop-off. Strong "conversion page" + traffic-source attribution due to CRM context. Stats refresh every 40 minutes.
- **Tally** — best privacy story. Aggregate only, no cookies, EU-hosted. Free tier capped to 7 days; per-question drop-off is paid.
- **Jotform** — comprehensive but stores per-visitor IPs + screen res. No built-in per-page drop-off (docs explicitly punt to GA4).
- **Fillout** — clean spec: Unique Visitors → Started → Finished, page-level drop-off paid.

**Common event taxonomy** (what they all fire from their embeds):

| Event | Fires on |
|---|---|
| `view` | Embed renders on the page |
| `start` | First field focus |
| `field_change` / `question_change` / `page_view` | Per step / per field touched |
| `submit_attempt` | Submit click, before POST |
| `submit_success` | 2xx from submit |

**Common architecture pattern**:

- Embed JS uses `navigator.sendBeacon()` (or `fetch keepalive`) to ingest events.
- Sessions identified by an in-memory or `sessionStorage` UUID — no cookie.
- Server stores raw events for 30–90 days for late-binding revision; nightly rollups feed the dashboard.
- Drop-off is **derived server-side** from "last field touched in sessions without submit, after idle timeout."

**Gaps in the market** (things nobody nails — our potential differentiators):

1. Cookieless by default AND per-field drop-off (Tally has the first, Typeform has the second; nobody has both at indie prices).
2. Self-hosted / your-DB data residency.
3. Per-field validation error rate (the data is already at the client; nobody surfaces it).
4. Per-field "time to answer" heatmap (Typeform only shows aggregate avg time).
5. Predicted completion rate at publish-time, based on field count / type — leveraging our AI subsystem.
6. CSV/JSON export of aggregates, not just submissions.

---

## 3. Event taxonomy (what our embed will fire)

Five events, plus one derived signal:

| Event | When | Payload |
|---|---|---|
| `view` | First `renderForm` call on the page | `formId`, `sessionId`, `referrer`, `userAgent`, `viewport` |
| `start` | First field focus | `formId`, `sessionId` |
| `field_change` | Each new field touched (debounced — fires on blur, not on every keystroke) | `formId`, `sessionId`, `fieldId` |
| `field_error` | An inline validation error renders on a field | `formId`, `sessionId`, `fieldId`, `errorKind` (e.g. `required`, `email`, `pattern`) |
| `submit_attempt` | Submit click, before POST | `formId`, `sessionId` |
| `submit_success` | derived from existing submission record | (no embed event needed) |

**Derived signals** (computed server-side at rollup time):

- **`abandon`**: sessions with `view` (and optionally `start`) but no `submit_success` after 30-min idle. Last `field_change` for that session becomes the drop-off point.
- **`time_to_complete`**: difference between `start` and matched `submit_success`. Per-session.
- **`time_per_field`**: difference between consecutive `field_change` events. Per-field, per-session, aggregated to avg / median.

**Why `submit_success` isn't an event**: the existing `submission` record IS the source of truth. We join sessions to submissions by `(formId, sessionId)` — embed passes `sessionId` along with the submit POST.

---

## 4. Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                            Host page                                     │
│                                                                          │
│  ┌────────────────────────────────────────────┐                          │
│  │  @strapi-forms/embed                       │                          │
│  │    sessionId = sessionStorage UUID         │                          │
│  │    sends events via sendBeacon()           │                          │
│  └──────────────────┬─────────────────────────┘                          │
└─────────────────────┼────────────────────────────────────────────────────┘
                      │
                      ▼  POST /api/forms/events  (batched, 1×/event burst)
┌──────────────────────────────────────────────────────────────────────────┐
│                            Strapi plugin                                 │
│                                                                          │
│  Public ingest controller                                                │
│    - validates event shape                                               │
│    - hashes IP with rotating daily salt                                  │
│    - writes to Knex direct table:                                        │
│  ┌───────────────────────────────────────────┐                           │
│  │  strapi_forms_events                      │                           │
│  │    id, form_id, session_id, type,         │                           │
│  │    field_id, error_kind, ip_hash, ua,     │                           │
│  │    referrer, ts                           │                           │
│  └─────────────┬─────────────────────────────┘                           │
│                ▼                                                         │
│  Rollup worker (BullMQ if Redis; inline cron-style otherwise)            │
│    - every 5 min: incremental rollup of last 5-min window                │
│    - nightly: full-day rollup + abandon attribution                      │
│  ┌───────────────────────────────────────────┐                           │
│  │  strapi_forms_event_rollups               │                           │
│  │    form_id, day, views, starts, attempts, │                           │
│  │    submits, avg_seconds, dropoff_by_field │                           │
│  │    (jsonb)                                │                           │
│  └─────────────┬─────────────────────────────┘                           │
│                ▼                                                         │
│  Admin endpoint  GET /admin/forms/:id/analytics?range=30d                │
│    - reads rollups + most-recent today incrementally                     │
│    - returns funnel + per-field drop-off + daily series                  │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

**Storage choice** — both tables are **Knex direct** (not Strapi content types):
- Consistent with the existing `webhook_delivery_log` / `notification_delivery_log` pattern (see `resources/04-tech-decisions.md`).
- High-volume infrastructure data; user never browses raw rows.
- Allows compound indexes for the rollup queries (`(form_id, day)` etc.).

**Retention**:
- Raw events: **30 days**. Sufficient for the 30-day dashboard view + a buffer for late submissions. Env-var overridable.
- Rollups: **forever**. Tiny — one row per form per day per metric bucket.

**Cardinality safeguards**:
- Per-IP rate limit on `/api/forms/events` (reuse the rate-limit middleware from 0.3.0).
- Hard cap of 100 events per session before further events are dropped.
- Sampling: if a form is recording >1k events/min, sample at 1:N (env-configurable).

---

## 5. Privacy posture

**Defaults (no admin config required)**:

- **No cookies.** `sessionId` is a `crypto.randomUUID()` written to `sessionStorage` only. Cleared on browser close.
- **IPs hashed with a daily salt** for unique-visitor counting. Salt rotates at UTC midnight → no cross-day re-identification.
- **No PII stored.** No email, name, or field values. Just event type + field id.
- **`Do-Not-Track` header respected** — if the browser sends `DNT: 1`, the embed doesn't fire events.
- **`navigator.globalPrivacyControl` respected** (CCPA / EU equivalent).

**Admin-controllable**:

- `STRAPI_FORMS_ANALYTICS_ENABLED=false` env var disables plugin-wide.
- Per-form toggle in `settings.analytics.enabled` for GDPR-strict forms.
- Optional `STRAPI_FORMS_ANALYTICS_ANONYMIZE_IPS_FULLY=true` skips even the daily-salted hash (no unique visitor counts, just view counts).

**Documentation requirement**:

- A `docs/analytics.md` page that documents exactly what's collected and what isn't — material for the user's own privacy policy.

---

## 6. v1 scope

**Ship**: the universal funnel + per-field drop-off + 30d chart. The conservative core that matches table-stakes from competitors.

**Defer** to v1.1+ : the differentiators (error rate, time-to-answer, predicted completion). Reasons:
- Universal funnel is the headline metric. Without it, the differentiators are noise.
- Differentiators benefit from "we have real data" — easier to validate them once v1 events are flowing.
- v1 surface area must be small to ship in a single release without bugs.

**v1 dashboard surface**:

- Top funnel card (one row, four numbers): `Views · Starts · Submissions · Completion rate · Avg time`
- 30-day line chart: views (light) overlaid with submissions (dark)
- Per-field drop-off table: field label, views-of-this-field, completions, drop-off %, sortable
- Date range picker: 7d / 30d / 90d / all-time
- "Export CSV" button — aggregate rollups, not raw events

**v1 implementation slices** (build order):

1. Knex migration: `strapi_forms_events` + `strapi_forms_event_rollups`.
2. Embed runtime: sessionId minting + `sendBeacon` event reporter.
3. Public ingest endpoint `POST /api/forms/events` with rate limit + IP hashing.
4. Rollup worker (BullMQ if Redis, inline cron otherwise).
5. Admin endpoint `GET /admin/forms/:id/analytics`.
6. Admin SPA "Analytics" tab on FormBuilder with funnel card + chart + drop-off table.
7. CSV export.
8. Docs + privacy policy material.

Rough effort: 6–8 hours of focused work.

---

## 7. Decisions (defaults pending sign-off)

| # | Question | Default | Why |
|---|---|---|---|
| 1 | v1 scope | Universal funnel only | Differentiators benefit from real data flowing first |
| 2 | Raw event retention | 30 days | Matches Tally; small footprint |
| 3 | Session strategy | `sessionStorage` UUID (client) + daily-salted hashed IP (server unique counts) | Cookieless but accurate uniques |
| 4 | Rollup cadence | 5-min `setInterval` tick, all deployments (v1) | See note below — BullMQ deferred |
| 5 | Dashboard placement | "Analytics" tab on each form (in the FormBuilder header) | Avoid a separate page until there's demand |
| 6 | Per-form opt-out | `settings.analytics.enabled` boolean (default `true`) | GDPR-strict forms can disable per-form |
| 7 | Submission counting | Query existing submissions table for the numerator | One source of truth; no double-counting |

> **Implementation note on #4 (rollup cadence).** v1 shipped a process-local
> `setInterval` tick for *all* deployments, not BullMQ-when-Redis. Rationale:
> rollups upsert on `(form_document_id, day)` and are fully idempotent, so a
> second Strapi instance running its own tick converges to identical rows —
> worst case is duplicated compute, never wrong data. And the read path
> computes the unsealed tail (today) live regardless, so the dashboard is
> correct even if a tick is late or hasn't run. This kept v1 surface area
> small. Moving rollup scheduling onto BullMQ to *dedupe* that compute in
> horizontally-scaled deployments is a clean follow-up that doesn't affect
> correctness. The scheduler lives behind `services/analytics/index.ts#init`.

---

## 8. Future roadmap

In the rough order I'd ship them — each is its own minor version.

### v1.1 — Validation error rate (1–2 hours)

Already in the embed's validation path. Fire `field_error` events when an inline error renders. Roll up to "% of submissions where field X errored at least once" and surface as a column in the drop-off table.

**Why first**: data already at the client, cheapest UX win, nobody else does it.

### v1.2 — Time-to-answer heatmap (2–3 hours)

Compute time between consecutive `field_change` events. Roll up to avg / median per field. Surface as a stacked horizontal bar per field (fields that take >40s avg get flagged).

**Why second**: same raw events, just different aggregation.

### v1.3 — Device / referrer / geo breakdowns (3–4 hours)

Standard segmentation panel. Device from UA (mobile/tablet/desktop). Referrer from `document.referrer`. Geo from IP-to-country lookup (offline DB like `geoip-lite` — no third-party calls).

**Why third**: requires adding the geo-IP dataset; not as differentiated as the per-field surfaces.

### v1.4 — Standalone analytics page (1–2 hours)

Plugin sidebar gets an "Analytics" entry; lists all forms with their funnel summary in a sortable table. Click into one to see the per-form dashboard (same as v1 tab).

**Why fourth**: only worth it when users have many forms.

### v1.5 — AI-powered insights ("Why is your conversion low?") (5–8 hours)

Feed the rollup data to the AI provider. AI generates plain-English observations: "Your Severity field has a 32% drop-off — most users abandon there. Consider making it optional or adding help text." Surface as a "Suggestions" panel on the dashboard.

**Why fifth**: requires v1.1 + v1.2 data to be meaningful. Big differentiator once it lands.

> **Architectural prerequisite — build the AI skills framework first.**
> Today the AI layer has two parallel pipelines (layout, style), each a
> hand-maintained trio of loose-schema + prompt + normalize spread across
> ~3 files, plus a `target` flag the orchestrator branches on. Adding a
> *third* AI capability (insights) this way means a third parallel
> pipeline + a third mode flag — the same "build the new feature on top of
> the debt" trap we hit with the FormBuilder god-component.
>
> Before v1.5, refactor to the `AiSkill` registry from the architecture
> review: each capability (`FormLayoutSkill`, `FormStyleSkill`,
> `FormInsightsSkill`) is one cohesive unit declaring its `inputSchema`,
> `buildPrompt`, `normalize`, and `apply`. The orchestrator dispatches to
> registered skills instead of branching on a flag. ~2–3 hours. This is
> the natural seam and v1.5 is its forcing function — same reasoning as
> "decompose the god-files before building analytics on them."
>
> Note: this is *orthogonal* to the shared-theme-module refactor
> (architecture audit candidate #1+#2). Skills consolidate the AI-facing
> schema/prompt/normalize; the theme-module refactor de-duplicates the
> two render-surface resolvers + ThemeConfig types. Both are worth doing;
> neither blocks the other.

### v1.6 — Predicted completion rate at publish-time (4–6 hours)

When a form is published, the AI estimates likely completion rate based on field count, types, validation strictness, and historical patterns across the user's other forms. Surfaces as "Predicted: 68% completion. Risky fields: Severity (long), Steps to Reproduce (long-text required)."

**Why sixth**: only useful after v1.5 has confidence-built insights.

### v1.7 — CSV / JSON export of aggregates (1 hour)

Already on the v1 list as the "Export CSV" button — formalised. Add JSON variant for programmatic access.

### v1.8 — Webhook on funnel anomaly (3 hours)

"Notify me when completion drops below X%" — fires the existing webhook dispatcher with an alert payload. Hooks into our existing webhook infrastructure for free.

### v1.9 — Comparison view (4 hours)

"Compare this 30 days vs the previous 30 days" — overlays two periods in the chart, computes deltas (Submissions: +12%, Drop-off on Email: −4 pp). Standard A/B-style report.

### v1.10 — Realtime "live submissions" feed (3 hours)

Server-Sent Events stream to the analytics tab. Last 10 submissions appear in a sidebar with timestamps. Nice for high-traffic events / launches.

### Long-tail / Maybe / Not sure

- **Session replay (PII-safe)** — show which path a user took through conditional logic, without recording keystrokes. Heyflow-style.
- **A/B testing** — two form variants, sticky session, automatic winner detection. Big feature; probably out of scope without a major version bump.
- **Funnel rollups for "view → start → first-required-field-blur → submit"** — finer granularity if needed.
- **Multi-form funnels** — when a workflow spans multiple forms (e.g., signup → onboarding → first-task), track the cross-form drop-off. Unclear if users want this.
- **External analytics integrations** — Plausible, Fathom, GA4. Tally has these. We could provide a hook (`onEvent`) on the embed; let users pipe events to wherever.
- **Per-user-segment dashboards** — "completion rate for first-time visitors vs returning." Possible once we have referrer + session data, but borderline-PII.

---

## 9. Open questions

Resolved at v1 sign-off (2026-06-01):

1. **Rate-limit middleware gating analytics ingest?** → **Separate, looser
   limit.** A dedicated `analytics-events` rate-limit middleware keyed per
   (IP, formId) with a generous budget (~100/min, env-overridable), plus the
   per-session hard cap (§4) and optional sampling. The submit endpoint's
   strict 10/min limit is left untouched.

2. **What does the embed do if `sendBeacon` fails?** → **Drop silently.**
   Analytics is best-effort; no buffering or retry.

3. **Should `field_change` debounce/throttle?** → **Fire on blur**, plus a
   5-second-idle flush for the field the user was last in when they navigate
   away.

4. **Does the `documentId | slug` lookup extend to events?** → **Yes.** The
   ingest endpoint resolves the form by documentId or slug, same as the embed
   data attribute and the submit endpoint.

5. **Do we count the admin's own previews as events?** → **No.** The admin
   preview passes a flag suppressing event emission, so the form author isn't
   double-counted.

---

## 10. Out of scope (explicit non-goals)

To prevent scope creep:

- ❌ No third-party trackers / pixels (Facebook, Google, etc.). If users want them, they wire them up via the existing webhook system.
- ❌ No keystroke / mouse-movement / scroll-depth tracking.
- ❌ No "heatmaps" beyond per-field aggregates.
- ❌ No multi-tenant analytics SaaS surface — this is your-Strapi-your-data only.
- ❌ No realtime active-user count ("3 people filling this form RIGHT NOW") — voyeuristic, marginal value.
- ❌ No PII collection ever. No way to "see who submitted" from analytics — that's what the submissions inbox is for.

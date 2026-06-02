# Analytics

Every published form gets a **"did my form work?"** dashboard: how many people
saw it, how many started filling it, how many submitted, and where the rest
dropped off. It's **cookieless, self-hosted, and collects no PII** — the data
never leaves your Strapi instance.

Open it from the form builder toolbar → **Analytics**.

## What you see

- **Funnel** — Views · Starts · Submissions · Completion rate · Average time to
  complete, for the selected range.
- **Trend chart** — daily views (light line) overlaid with submissions (dark).
- **Per-field drop-off** — for each field: how many sessions reached it, how
  many abandoned there, and the drop-off rate. Fields losing >30% are flagged.
- **Date range** — 7 / 30 / 90 days, or all time.
- **Export CSV** — the daily aggregate series, not raw events.

## How it works

The embed runtime fires five events as a visitor moves through the form:

| Event | When |
|---|---|
| `view` | The form renders on the page |
| `start` | First focus into any field |
| `field_change` | A field loses focus (or 5s idle) — used for drop-off |
| `field_error` | Stored for a future release; not surfaced yet |
| `submit_attempt` | The submit button is pressed |

Submissions are **not** a separate event — the dashboard joins your existing
submission records to the event sessions, so the submission count is always the
single source of truth. Events ship in small batches via `navigator.sendBeacon`
and are written to two Knex-managed tables (`strapi_forms_events`,
`strapi_forms_event_rollups`). A background worker rolls completed days up every
5 minutes; the dashboard reads sealed rollups plus a live computation of today,
so it's accurate even if a rollup is late.

## Privacy

The analytics layer is designed to be **EU-defensible without a consent banner**.
Use this section as material for your own privacy policy.

**What is collected**

- The event type (`view`, `start`, …) and, for field events, the **field id** —
  never the value typed into it.
- A **session id**: a random UUID held in `sessionStorage`, cleared when the tab
  closes. Not a cookie; not shared across tabs or sites; not linkable to a person.
- A **daily-salted hash of the visitor's IP** for counting unique visitors. The
  salt rotates every UTC midnight, so the same visitor can't be re-identified
  across days. The raw IP is never stored.
- The page referrer, user-agent string, and viewport size (for future
  device/source breakdowns).

**What is never collected**

- ❌ No cookies, no `localStorage`, no cross-device or cross-site tracking.
- ❌ No PII — no names, emails, or any submitted field **values**.
- ❌ No third-party trackers or pixels. Nothing leaves your Strapi instance.
- ❌ No keystroke, mouse, or scroll tracking.

**Respected browser signals**

- **Do-Not-Track** (`DNT: 1`) — the embed sends no events.
- **Global Privacy Control** (`navigator.globalPrivacyControl`) — same.

## Controls

Plugin-wide and per-form, all optional:

| Setting | Default | Effect |
|---|---|---|
| `STRAPI_FORMS_ANALYTICS_ENABLED` | `true` | `false` disables analytics entirely (no events recorded, no rollup worker) |
| `STRAPI_FORMS_ANALYTICS_RETENTION_DAYS` | `30` | How long raw events are kept; rollups are kept indefinitely |
| `STRAPI_FORMS_ANALYTICS_SALT` | _(random per process)_ | Set a stable value for consistent IP hashing across restarts / instances |
| `STRAPI_FORMS_ANALYTICS_ANONYMIZE_IPS_FULLY` | `false` | `true` skips even the salted hash — view counts only, no unique-visitor counts |
| `STRAPI_FORMS_ANALYTICS_RATELIMIT_MAX` | `100` | Max ingest requests per minute per (IP, form) |

Per-form opt-out lives in the form's `settings.analytics.enabled` (default
`true`) — useful for a GDPR-strict form on an otherwise-tracked site.

The admin **preview** never counts: it renders with analytics suppressed, so
testing your own form doesn't pollute the numbers.

## Retention & cost

- **Raw events**: kept `STRAPI_FORMS_ANALYTICS_RETENTION_DAYS` (default 30),
  then pruned. Enough for the 30-day view plus a buffer.
- **Rollups**: one small row per form per day, kept indefinitely.
- **Caps**: 100 events per session hard cap, plus the per-IP ingest rate limit,
  keep a viral form from burying the database.

## Roadmap

v1 ships the universal funnel + per-field drop-off. Planned next: validation
error-rate per field, time-to-answer heatmaps, device/referrer/geo breakdowns,
and AI-generated "why is conversion low?" insights. See
[`resources/07-analytics.md`](../resources/07-analytics.md) for the full plan.

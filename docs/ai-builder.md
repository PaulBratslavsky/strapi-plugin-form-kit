# AI form builder

Build forms by describing them in plain English. Refine them the same way.
Style them the same way. Bring your own API key — your form data stays on
your Strapi instance.

The AI lives in a slide-in drawer in the form builder (Sparkle icon in the
toolbar). What it does depends on which view you're in:

- **Build view** → AI generates / refines the *layout* (fields, validations).
- **Style view** → AI generates / refines the *styling* (theme, colors, typography).

Same drawer, mode-aware system prompt. You don't have to think about which
"tool" to invoke — the current view picks the default behaviour. The output
in both modes is a constrained schema that's validated and applied
deterministically; the AI never emits raw CSS or arbitrary JSON.

## Quick setup

1. Open **Settings → Forms → AI builder** in the Strapi admin (cog icon
   in the left sidebar).
2. Pick a provider:
   - **Anthropic (Claude)** — recommended for quality. Get an API key at
     [console.anthropic.com](https://console.anthropic.com).
   - **OpenAI (GPT)** — get a key at
     [platform.openai.com](https://platform.openai.com).
   - **Ollama** — for fully local, no API key needed. Install Ollama, run
     `ollama serve`, then pull a model: `ollama pull llama3` (or any chat
     model). Base URL defaults to `http://localhost:11434/v1`.
   - **Mock** — keyword-matching stub for testing without any API call.
3. Paste your API key (encrypted at rest with AES-256-GCM) and save.
4. Click **Test connection** to verify.

## Using AI to build a form

1. Create a new form (Forms → New form). Land in an empty canvas.
2. Click the **AI** button in the toolbar (sparkle icon).
3. A drawer slides in from the right. Type a description, e.g.:
   ```
   Contact form for an architecture firm — name, email, company,
   project type dropdown (residential / commercial / interior),
   and a message field.
   ```
4. Watch fields appear in the chat as the model emits them.
5. The canvas to the left updates in real time. You can drag fields,
   tweak labels, or ask for more changes — all without closing the
   drawer.

## Refining an existing form

When the canvas has fields, the AI drawer switches to **refine mode**.
Same button, different system prompt. Try:

- "Make the company field required."
- "Add a phone field after email."
- "Remove the message field."
- "Add a budget dropdown with 4 ranges."

The whole schema is rewritten each time — undo (`Cmd+Z`) won't reach
before the AI applied. We're working on history-preserving refines.

## Pointing fields at your collections

The AI knows about your Strapi collections. When a prompt references one,
it generates a choice field backed by `optionsSource` instead of
hand-written options — so the choices stay in sync with your data:

- "Add an event picker from our Events collection."
- "Let them choose a product (dropdown)."
- "Department radio buttons from the Departments collection."

It picks a sensible `labelField` (the first reasonable name/title
attribute) and leaves `valueField` as `documentId` unless you ask for a
different identifier. You can also wire this up by hand — see
[form-schema.md](form-schema.md#collection-backed-options-optionssource).

Only collections with at least one text attribute are offered to the
model; the field falls back to `documentId` for the label if none exist.

## Styling with AI

Switch to **Style** mode and the AI drawer changes its system prompt to
style-focused. It emits a partial theme (preset + overrides) that gets
merged over the current theme — nothing else changes.

Examples:

- "Make it dark mode."
- "Style it like a Stripe payment form."
- "Newspapery / editorial vibe."
- "More friendly — rounder corners, warmer colors."
- "Brutalist: mono font, sharp edges, no shadow."
- "Surprise me — be creative."

The AI is constrained to a small vocabulary: 4 preset themes
(`clean` / `editorial` / `friendly` / `bold`), a palette of named colors
(`indigo` / `rose` / `midnight` / `lime` / ...), and enumerated values for
radius, font family, spacing, button style, etc. It can't return broken
CSS — worst case it picks the wrong vibe, and you re-prompt.

Colors are addressable independently: the form background
(`backgroundColor`), the label/input **text** (`textColor`), and the
input-box background (`inputBackgroundColor`). The last one matters for
dark mode — without it the input boxes keep the preset's light fill, so
"dark inputs, high-contrast text" or "make it dark mode" now darkens the
fields too, not just the page.

## "I'm feeling lucky"

In Style mode the panel header has an **I'm feeling lucky** button. It
applies one of 8 hand-curated vibes at random (Espresso, Brutalist,
Sunset, Lab coat, 90s zine, Pastel, Neon arcade, Editorial luxe). No AI
call — pure deterministic randomness. Shift-click to step through them in
order so you can compare.

These vibes are also the few-shot examples the style AI sees in its
prompt, so prompting "make it neon" tends to land close to the Neon
arcade vibe with tweaks.

## Privacy and data flow

- Form **data** (submissions) is never sent to any AI provider. AI only
  sees the prompts you type into the drawer.
- API keys are stored **encrypted** in the `ai-provider-config` content
  type (AES-256-GCM with `APP_KEYS[0]` as the derivation key). They are
  never returned by any endpoint — only `apiKeyConfigured: true|false`.
- For production deployments where you don't want admin users to see or
  rotate the key, set env vars instead — they override the UI:

  ```bash
  STRAPI_FORMS_AI_PROVIDER=anthropic
  STRAPI_FORMS_AI_API_KEY=sk-ant-...
  STRAPI_FORMS_AI_MODEL=claude-haiku-4-5-20251001
  STRAPI_FORMS_AI_BASE_URL=          # optional, mostly for self-hosted
  ```
  The settings page shows a banner indicating env vars are active.

## How it works (architecture)

The AI never produces raw form JSON or CSS directly — instead, it emits
a **loose shape** (constrained vocabulary only) and the plugin transforms
it deterministically into the canonical artifact. This is what lets
small local models (8B params) produce reliable forms.

**Layout pipeline:**
```
your prompt
  → model emits { fields: [{ type, name, label, required, ... }] }
  → loose validator (permissive)
  → normaliser (UUIDs, validations array, type aliases, defaults)
  → strict validator (FormSchemaCore)
  → applied to canvas
```

So when you ask for a "telephone" field, the model might emit
`{ type: "tel", ... }` — the normaliser maps "tel" → "phone" and you
get a phone field. Same for "select" → "dropdown", missing labels
derived from `name`, missing UUIDs generated server-side.

**Style pipeline:**
```
your prompt
  → model emits { preset?, primaryColor?, borderRadius?, ... }
  → loose validator (all fields optional, enums only)
  → color resolver (named colors → hex)
  → merged over current theme (partial update)
  → applied to canvas
```

The AI picks from an enumerated vocabulary — no raw CSS — so the output
is always valid. If a generation fails parsing, the harness retries up
to 2× with the model's previous error fed back in.

Server-side files involved:
- `services/ai/loose-schema.ts` / `loose-style-schema.ts` — what the AI
  may emit
- `services/ai/normalize.ts` / `normalize-style.ts` — deterministic
  transform to canonical shapes
- `services/ai/parse.ts` — shared parse pipeline (fences strip → carve
  outermost `{...}` → JSON.parse → loose-validate → normalise →
  strict-validate)
- `services/ai/prompts.ts` — system prompts (one per pipeline)
- `services/ai/{anthropic,openai,mock,none}.ts` — provider adapters
- `controllers/admin-ai.ts` — admin endpoints (`/admin/ai/stream` is SSE)

## Model recommendations

| Provider | Model | Notes |
|---|---|---|
| Anthropic | `claude-haiku-4-5-20251001` | Default. Fast, cheap, accurate. |
| Anthropic | `claude-sonnet-4-6` | Better reasoning, ~3× cost. |
| OpenAI | `gpt-4o-mini` | Default. Comparable to Haiku. |
| OpenAI | `gpt-4o` | Better, slower, pricier. |
| Ollama | `llama3` | Default. ~5GB. Decent for English form briefs. |
| Ollama | `gemma2:9b` | More verbose. |
| Ollama | smaller (1–3B) | Often misses JSON shape — only with the harness. |

For local models, 8B+ is the sweet spot. Below 4B the harness has more
work to do and refusal/derail rate goes up.

## Troubleshooting

**"AI builder is not configured"** in the drawer.
Settings hasn't been saved with a real provider. Click "Open AI
settings" → pick a provider → save.

**Save shows green "Saved at..." but the page reverts to None on reload.**
Strapi server is running stale code. Restart the dev server (or the
production process) — schema and content-type changes need a boot to
take effect.

**Streaming endpoint returns 401.**
Browser hasn't been hard-refreshed since a recent admin SPA rebuild —
the JWT key isn't in localStorage yet. Cmd+Shift+R (hard reload).

**Ollama times out / hangs.**
First call to a model loads it into RAM (10–30 sec for ~5GB models).
Click "Test connection" once before using the AI drawer so the model
is warm.

**"OpenAI-compatible provider produced invalid output after 3 attempts".**
Means the model produced something the loose schema couldn't accept
even after re-prompting. Common with very small models (<3B). Switch to
a bigger model, or use the Mock provider while debugging.

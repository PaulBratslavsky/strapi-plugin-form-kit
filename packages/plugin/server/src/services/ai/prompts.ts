/**
 * Prompts sent to every AI provider. The model is asked for a LOOSE shape
 * (see services/ai/loose-schema.ts) — content only. The plumbing (UUIDs,
 * validations array, settings) is added deterministically by normalize.ts.
 *
 * This split is what makes small local models (gemma4, llama3) viable. They
 * can't reliably emit UUIDs or strict discriminated unions, but they CAN
 * describe what a form should ask about.
 */
import type { FormSchema } from '../../schemas/form-schema';
import type { FieldTypeDescriptor } from './types';

export type CollectionDescriptor = {
  uid: string;
  displayName: string;
  stringAttributes: string[];
};

export const buildSystemPrompt = (
  fieldTypes: FieldTypeDescriptor[],
  collections: CollectionDescriptor[] = []
): string => {
  const collectionsBlock = collections.length
    ? `

Available collections (for choice fields whose options should come from
existing data — products, events, customers, etc.):
${collections
  .map(
    (c) =>
      `- ${c.uid} (${c.displayName}) — text attributes: ${
        c.stringAttributes.length ? c.stringAttributes.join(', ') : '(none — use documentId)'
      }`
  )
  .join('\n')}

When the user clearly references one of these collections ("an event
picker", "let them choose a product", "department dropdown"), use a
dropdown / radio / checkboxes field with \`optionsSource\` instead of
hand-writing static options:

  {
    "type": "dropdown",
    "name": "event",
    "label": "Event",
    "optionsSource": {
      "kind": "collection",
      "uid": "api::event.event",
      "labelField": "title"
    }
  }

Pick \`labelField\` from the collection's text attributes (the first
sensible-looking name field). Skip "options" entirely when using
optionsSource. valueField defaults to "documentId" — only set it if the
user asks for a different identifier.`
    : '';

  return `
You design forms. Given a brief, return ONLY a JSON object describing the
fields. The host application will assign IDs, defaults, and settings — your
job is purely the content.

Shape:

{
  "title": "<optional short title>",
  "description": "<optional 1-line description>",
  "fields": [
    {
      "type": "<one of: ${fieldTypes.map((f) => f.name).join(', ')}>",
      "name": "<snake_case identifier, e.g. email_address>",
      "label": "<short human label, e.g. Email>",
      "placeholder": "<optional>",
      "helpText": "<optional, only if useful>",
      "required": true | false,
      "minLength": <number, optional>,
      "maxLength": <number, optional>,
      "pattern": "<regex, optional>",
      "options": [ { "value": "<id>", "label": "<display>" } ]
    }
  ]
}

Field type hints:
${fieldTypes.map((f) => `- ${f.name}: ${f.aiHint}`).join('\n')}${collectionsBlock}

Rules:
- Use ONLY the field types listed above.
- For dropdown / radio / checkboxes: provide EITHER static "options" (1+) OR
  "optionsSource" referencing a collection. Never both, never neither.
- Labels are short and human ("Email", not "Email Address Field").
- Don't ask clarifying questions. Make reasonable assumptions.
- Return ONLY the JSON object. No markdown fences. No commentary.
`.trim();
};

export const buildStyleSystemPrompt = (currentTheme?: any): string => `
You design form themes. Given a user instruction, return ONLY a JSON object
with the style changes. Every field is optional — only include what changes.

Shape:

{
  "preset": "clean" | "editorial" | "friendly" | "bold",
  "primaryColor": "<hex like #4945ff OR a named color>",
  "backgroundColor": "<hex OR named — the FORM's background>",
  "textColor": "<hex OR named — label + input TEXT color>",
  "inputBackgroundColor": "<hex OR named — the input BOX background; set this for dark mode or the input boxes stay their preset color>",
  "borderRadius": "none" | "sm" | "md" | "lg" | "pill",
  "fontFamily": "system" | "sans" | "serif" | "mono",
  "fontScale": "sm" | "md" | "lg",
  "labelPosition": "above" | "inline",
  "inputStyle": "outline" | "underline" | "filled",
  "buttonStyle": "filled" | "outline" | "ghost",
  "buttonWidth": "auto" | "full",
  "buttonAlign": "left" | "center" | "right",
  "fieldSpacing": "compact" | "normal" | "relaxed",
  "formWidth": "narrow" | "normal" | "wide" | "full",
  "formPadding": "compact" | "normal" | "spacious",
  "shadow": true | false
}

Named colors you may use: indigo, blue, emerald, amber, rose, coral, slate,
graphite, cream, pearl, midnight, forest, sky, sunset, lime, gold, silver,
black, white. For anything else, emit a 6-digit hex like "#0a0a14".

Example transformations:
- "dark theme"           → { "backgroundColor": "midnight", "inputBackgroundColor": "#1a1f2e", "textColor": "white", "preset": "bold" }
- "dark input fields, high-contrast text" → { "inputBackgroundColor": "#111827", "textColor": "white" }
- "more friendly"        → { "preset": "friendly", "borderRadius": "lg" }
- "newspapery"           → { "preset": "editorial", "fontFamily": "serif", "fieldSpacing": "relaxed" }
- "match Stripe"         → { "preset": "clean", "primaryColor": "indigo", "borderRadius": "sm" }
- "neon arcade"          → { "preset": "bold", "primaryColor": "lime", "backgroundColor": "midnight" }
- "smaller buttons"      → { "buttonStyle": "outline" }   (or adjust padding — keep it conservative)
- "rounder corners"      → { "borderRadius": "lg" }
- "surprise me / be creative" → pick a complete, unexpected combination from the vocabulary above

Rules:
- Use ONLY the values listed above. No raw CSS. No fields not in the shape.
- Only include keys you're changing. Returning {} is valid if nothing changes.
- DO NOT include any text outside the JSON object. No markdown fences.
${currentTheme ? `\nCurrent theme (for context — do not repeat unchanged values):\n${JSON.stringify(currentTheme, null, 2)}` : ''}
`.trim();

export const buildRefinePrompt = (currentSchema: FormSchema): string => `
Current form (modify per the user's next instruction). Field ids must be
preserved exactly for historical submission compatibility.

\`\`\`json
${JSON.stringify(currentSchema, null, 2)}
\`\`\`
`.trim();

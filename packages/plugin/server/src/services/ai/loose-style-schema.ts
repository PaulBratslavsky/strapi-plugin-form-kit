/**
 * Loose schema the AI is asked to emit for style changes. Constrained
 * vocabulary only — the model never generates raw CSS. Each enum value
 * maps to a known set of CSS-var assignments in normalize-style.ts.
 *
 * Optionality: every field is optional, including `preset`. A response of
 * `{}` means "no change". A response of `{ backgroundColor: '#0a0a14' }`
 * means "tweak only the background, leave everything else alone."
 */
import { z } from 'zod';

// Colors are permissive at the schema level — the model can emit hex,
// a named color from our palette, a CSS named color, or whatever weirdness
// it dreams up. normalize-style.ts is responsible for resolving valid
// values and silently dropping unknown ones. This mirrors how the layout
// pipeline treats unknown field types (drop or alias, never throw).
// Previously this used a strict enum and a single unfamiliar color name
// from the model would fail the whole response → 3 retries → user-visible
// error.
const ColorValue = z.string();

// Enum values are still strict — they're a small known vocabulary the
// model can hit reliably, and falling through to "drop the field" is a
// fine fallback if the model emits a wrong value.
export const LooseStyleSchema = z
  .object({
    preset: z.enum(['clean', 'editorial', 'friendly', 'bold']).optional(),
    primaryColor: ColorValue.optional(),
    backgroundColor: ColorValue.optional(),
    textColor: ColorValue.optional(),
    borderRadius: z.enum(['none', 'sm', 'md', 'lg', 'pill']).optional(),
    fontFamily: z.enum(['system', 'sans', 'serif', 'mono']).optional(),
    fontScale: z.enum(['sm', 'md', 'lg']).optional(),
    labelPosition: z.enum(['above', 'inline']).optional(),
    inputStyle: z.enum(['outline', 'underline', 'filled']).optional(),
    buttonStyle: z.enum(['filled', 'outline', 'ghost']).optional(),
    buttonWidth: z.enum(['auto', 'full']).optional(),
    buttonAlign: z.enum(['left', 'center', 'right']).optional(),
    fieldSpacing: z.enum(['compact', 'normal', 'relaxed']).optional(),
    formWidth: z.enum(['narrow', 'normal', 'wide', 'full']).optional(),
    formPadding: z.enum(['compact', 'normal', 'spacious']).optional(),
    shadow: z.boolean().optional(),
  })
  .passthrough();

export type LooseStyleInput = z.infer<typeof LooseStyleSchema>;

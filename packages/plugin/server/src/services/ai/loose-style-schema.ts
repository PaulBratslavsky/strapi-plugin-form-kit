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

const Hex = z.string().regex(/^#[0-9a-f]{3,8}$/i);

// Named colors the model is allowed to use as a shortcut. Mirrors the
// vibe palette; normalize-style.ts resolves these to hex.
const NAMED_COLOR = z.enum([
  'indigo',
  'blue',
  'emerald',
  'amber',
  'rose',
  'coral',
  'slate',
  'graphite',
  'cream',
  'pearl',
  'midnight',
  'forest',
  'sky',
  'sunset',
  'lime',
  'gold',
  'silver',
  'black',
  'white',
]);

const ColorValue = z.union([Hex, NAMED_COLOR]);

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

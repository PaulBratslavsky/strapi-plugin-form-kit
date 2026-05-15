/**
 * Resolves the AI's loose style output to a concrete ThemeConfig that can
 * be merged into form.settings.theme. Pure code — never the model's job.
 *
 * Two important behaviours:
 *   1. Named colors are resolved to hex via NAMED_COLORS below. The model
 *      is allowed to emit either "indigo" or "#4945ff"; both end up as hex.
 *   2. Missing fields are left undefined so the caller can spread the result
 *      over the existing theme (partial updates by default). The current
 *      theme is therefore preserved for anything the AI didn't touch.
 */
import type { LooseStyleInput } from './loose-style-schema';

// Curated palette the prompt advertises to the model + a generous spillover
// of common CSS / Tailwind names so things the model emits unprompted
// ("navy", "teal", "lavender") still resolve instead of getting dropped.
const NAMED_COLORS: Record<string, string> = {
  // Curated (in the system prompt)
  indigo: '#4945ff',
  blue: '#0066cc',
  emerald: '#10b981',
  amber: '#f59e0b',
  rose: '#f06292',
  coral: '#f87171',
  slate: '#475569',
  graphite: '#27272a',
  cream: '#f8f2ea',
  pearl: '#fdfcf8',
  midnight: '#0a0a14',
  forest: '#166534',
  sky: '#0ea5e9',
  sunset: '#fb923c',
  lime: '#39ff14',
  gold: '#ffd400',
  silver: '#cbd5e1',
  black: '#000000',
  white: '#ffffff',
  // Common spillover the model picks unprompted
  red: '#dc2626',
  orange: '#f97316',
  yellow: '#eab308',
  green: '#22c55e',
  teal: '#14b8a6',
  cyan: '#06b6d4',
  navy: '#1e3a8a',
  purple: '#9333ea',
  violet: '#8b5cf6',
  lavender: '#c4b5fd',
  pink: '#ec4899',
  magenta: '#d946ef',
  brown: '#92400e',
  beige: '#f5f5dc',
  ivory: '#fffff0',
  charcoal: '#1f2937',
  gray: '#6b7280',
  grey: '#6b7280',
  lightgray: '#d1d5db',
  lightgrey: '#d1d5db',
  darkgray: '#374151',
  darkgrey: '#374151',
  darkblue: '#1e40af',
  lightblue: '#93c5fd',
  darkgreen: '#15803d',
  lightgreen: '#86efac',
  // Common semantic words the model uses for "light" or "dark" backgrounds
  light: '#fafafa',
  dark: '#0a0a14',
};

const resolveColor = (value: string | undefined): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return undefined;
  // Accept any hex (3, 4, 6, or 8 digits) — return canonical lowercase form.
  if (/^#[0-9a-f]{3,8}$/.test(trimmed)) return trimmed;
  // Accept rgb()/rgba()/hsl()/hsla() as-is; CSS engines parse them fine.
  if (/^(rgb|rgba|hsl|hsla)\(/.test(trimmed)) return trimmed;
  const named = NAMED_COLORS[trimmed];
  if (named) return named;
  // Last-ditch: try removing common modifiers ("dark-", "light-", "soft-").
  const stripped = trimmed.replace(/^(dark|light|soft|deep|bright|pale)[-\s]/, '');
  if (NAMED_COLORS[stripped]) return NAMED_COLORS[stripped];
  // Unknown — drop silently. Better than aborting the whole style update.
  return undefined;
};

export const looseToTheme = (loose: LooseStyleInput) => {
  const out: Record<string, unknown> = {};

  if (loose.preset) out.preset = loose.preset;

  const primary = resolveColor(loose.primaryColor);
  if (primary) out.primaryColor = primary;
  const background = resolveColor(loose.backgroundColor);
  if (background) out.backgroundColor = background;
  const text = resolveColor(loose.textColor);
  if (text) out.textColor = text;
  const inputBg = resolveColor(loose.inputBackgroundColor);
  if (inputBg) out.inputBackgroundColor = inputBg;

  // Pass-through enums (already validated by LooseStyleSchema).
  for (const key of [
    'borderRadius',
    'fontFamily',
    'fontScale',
    'labelPosition',
    'inputStyle',
    'buttonStyle',
    'buttonWidth',
    'buttonAlign',
    'fieldSpacing',
    'formWidth',
    'formPadding',
  ] as const) {
    const value = loose[key];
    if (value !== undefined) out[key] = value;
  }
  if (typeof loose.shadow === 'boolean') out.shadow = loose.shadow;

  return out;
};

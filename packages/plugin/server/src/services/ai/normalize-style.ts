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

const NAMED_COLORS: Record<string, string> = {
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
};

const resolveColor = (value: string | undefined): string | undefined => {
  if (!value) return undefined;
  if (value.startsWith('#')) return value.toLowerCase();
  const named = NAMED_COLORS[value.toLowerCase()];
  return named ?? undefined;
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

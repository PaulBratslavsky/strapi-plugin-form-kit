/**
 * Form theming. The form's `settings.theme` carries a preset + optional overrides;
 * everything resolves to a small set of CSS variables consumed by both the in-admin
 * preview and the public embed snippet.
 *
 * Source of truth for the variable names is `@strapi-forms/embed`'s styles.css —
 * keep in sync.
 */

export type ThemePreset = 'clean' | 'editorial' | 'friendly' | 'bold';
export type BorderRadius = 'none' | 'sm' | 'md' | 'lg' | 'pill';
export type FontFamily = 'system' | 'sans' | 'serif' | 'mono';
export type FontScale = 'sm' | 'md' | 'lg';
export type LabelPosition = 'above' | 'inline';
export type InputStyle = 'outline' | 'underline' | 'filled';
export type ButtonStyle = 'filled' | 'outline' | 'ghost';
export type ButtonWidth = 'auto' | 'full';
export type ButtonAlign = 'left' | 'center' | 'right';
export type FieldSpacing = 'compact' | 'normal' | 'relaxed';
export type FormWidth = 'narrow' | 'normal' | 'wide' | 'full';
export type FormPadding = 'compact' | 'normal' | 'spacious';
export type FieldBorderWidth = 'none' | 'thin' | 'regular' | 'thick';
export type FieldPadding = 'compact' | 'normal' | 'large';
export type FieldSize = 'sm' | 'md' | 'lg';

export type ThemeConfig = {
  preset: ThemePreset;
  // Color overrides
  primaryColor?: string;
  backgroundColor?: string;
  textColor?: string;
  inputBackgroundColor?: string;
  // Layout overrides
  borderRadius?: BorderRadius;
  fontFamily?: FontFamily | string;
  fontScale?: FontScale;
  labelPosition?: LabelPosition;
  inputStyle?: InputStyle;
  buttonStyle?: ButtonStyle;
  buttonWidth?: ButtonWidth;
  buttonAlign?: ButtonAlign;
  fieldSpacing?: FieldSpacing;
  formWidth?: FormWidth;
  formPadding?: FormPadding;
  shadow?: boolean;
  // Submit button fine overrides (parallel to FieldStyle for inputs)
  buttonBg?: string;
  buttonColor?: string;
  buttonBorderColor?: string;
  buttonBorderWidth?: FieldBorderWidth;
  buttonPadding?: FieldPadding;
  buttonSize?: FieldSize;
  buttonBold?: boolean;
};

export const BUTTON_BORDER_WIDTH: Record<FieldBorderWidth, string> = {
  none: '0',
  thin: '1px',
  regular: '2px',
  thick: '3px',
};
export const BUTTON_PADDING: Record<FieldPadding, string> = {
  compact: '6px 14px',
  normal: '8px 20px',
  large: '12px 28px',
};
export const BUTTON_FONT_SIZE: Record<FieldSize, string> = {
  sm: '13px',
  md: '15px',
  lg: '17px',
};

export const RADIUS: Record<BorderRadius, string> = {
  none: '0px',
  sm: '4px',
  md: '8px',
  lg: '12px',
  pill: '999px',
};

export const FONT_FAMILY: Record<FontFamily, string> = {
  system: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  sans: '"Inter", system-ui, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
};

export const FONT_SCALE: Record<FontScale, { base: string; label: string }> = {
  sm: { base: '13px', label: '0.8125rem' },
  md: { base: '15px', label: '0.875rem' },
  lg: { base: '17px', label: '0.9375rem' },
};

export const FIELD_GAP: Record<FieldSpacing, string> = {
  compact: '12px',
  normal: '20px',
  relaxed: '32px',
};

export const FORM_WIDTH: Record<FormWidth, string> = {
  narrow: '420px',
  normal: '560px',
  wide: '720px',
  full: '100%',
};

export const FORM_PADDING: Record<FormPadding, string> = {
  compact: '16px',
  normal: '24px',
  spacious: '40px',
};

type PresetDef = {
  label: string;
  description: string;
  vars: Record<string, string>;
};

export const PRESETS: Record<ThemePreset, PresetDef> = {
  clean: {
    label: 'Clean',
    description: 'Professional SaaS — confident blue, balanced spacing, subtle shadow.',
    vars: {
      // The Linear / Stripe pattern: muted greys, a primary blue, sans-serif,
      // soft 8px corners, generous padding, hairline borders, a barely-there shadow.
      '--sf-primary': '#4945ff',
      '--sf-primary-contrast': '#ffffff',
      '--sf-text': '#1a1a2e',
      '--sf-muted': '#666687',
      '--sf-bg': '#ffffff',
      '--sf-border': '#d9d8ff',
      '--sf-border-focus': '#4945ff',
      '--sf-error': '#d02b20',
      '--sf-error-bg': '#fcecea',
      '--sf-success': '#328048',
      '--sf-success-bg': '#eafbe7',
      '--sf-radius': '8px',
      '--sf-font': '"Inter", system-ui, -apple-system, sans-serif',
      '--sf-shadow': '0 1px 2px rgba(33, 33, 52, 0.04)',
      '--sf-input-bg': '#ffffff',
      '--sf-border-width': '1px',
    },
  },
  editorial: {
    label: 'Editorial',
    description: 'Refined serif, hairline borders, lots of breathing room. NYT subscription vibe.',
    vars: {
      // Slow, considered, content-first. Serif type, near-black text on a warm-white
      // background, hairline rules instead of buttons-feel borders, no shadow, sharp corners
      // so it reads as a magazine page rather than an app.
      '--sf-primary': '#1a1a1a',
      '--sf-primary-contrast': '#ffffff',
      '--sf-text': '#1a1a1a',
      '--sf-muted': '#6b6b6b',
      '--sf-bg': '#fafaf7',
      '--sf-border': '#1a1a1a',
      '--sf-border-focus': '#1a1a1a',
      '--sf-error': '#9c1f1f',
      '--sf-error-bg': '#fafaf7',
      '--sf-success': '#1a1a1a',
      '--sf-success-bg': '#fafaf7',
      '--sf-radius': '0px',
      '--sf-font': '"Source Serif Pro", "Georgia", "Times New Roman", serif',
      '--sf-shadow': 'none',
      '--sf-input-bg': '#fafaf7',
      '--sf-border-width': '1px',
    },
  },
  friendly: {
    label: 'Friendly',
    description: 'Warm, approachable, pillowy radius, soft pastel chrome. Mailchimp / Calendly vibe.',
    vars: {
      // Marketing-form feel: peach/coral primary, cream background, very large 16px
      // radius, gentle pastel borders, a soft drop shadow that lifts everything off
      // the page. Friendly humanist sans.
      '--sf-primary': '#f97066',
      '--sf-primary-contrast': '#ffffff',
      '--sf-text': '#3a2e2e',
      '--sf-muted': '#8c7676',
      '--sf-bg': '#fff7f3',
      '--sf-border': '#f5d6cf',
      '--sf-border-focus': '#f97066',
      '--sf-error': '#c4321f',
      '--sf-error-bg': '#fdecea',
      '--sf-success': '#107a47',
      '--sf-success-bg': '#e3f7ec',
      '--sf-radius': '16px',
      '--sf-font': '"Nunito", "Inter", system-ui, sans-serif',
      '--sf-shadow': '0 4px 12px rgba(249, 112, 102, 0.12)',
      '--sf-input-bg': '#ffffff',
      '--sf-border-width': '1.5px',
    },
  },
  bold: {
    label: 'Bold',
    description: 'Neobrutalist — thick black borders, hard offset shadow, no-nonsense type.',
    vars: {
      // The Substack / Notion-template look: pure black borders 3px thick, a hard
      // 4px-offset shadow with no blur, a punchy accent color, slight corner radius.
      // Strong CTA + visual confidence.
      '--sf-primary': '#ffc83d',
      '--sf-primary-contrast': '#1a1a1a',
      '--sf-text': '#1a1a1a',
      '--sf-muted': '#4a4a4a',
      '--sf-bg': '#fffdf0',
      '--sf-border': '#1a1a1a',
      '--sf-border-focus': '#1a1a1a',
      '--sf-error': '#d02b20',
      '--sf-error-bg': '#ffe5e5',
      '--sf-success': '#1a1a1a',
      '--sf-success-bg': '#e5ffd9',
      '--sf-radius': '4px',
      '--sf-font': '"Space Grotesk", "Inter", system-ui, sans-serif',
      '--sf-shadow': '4px 4px 0 #1a1a1a',
      '--sf-input-bg': '#ffffff',
      '--sf-border-width': '3px',
    },
  },
};

export const PRESET_ORDER: ThemePreset[] = ['clean', 'editorial', 'friendly', 'bold'];

export const DEFAULT_THEME: ThemeConfig = { preset: 'clean' };

/**
 * Map legacy preset names to their new equivalents so forms saved before the
 * preset rename keep working.
 */
const LEGACY_PRESET_ALIAS: Record<string, ThemePreset> = {
  default: 'clean',
  minimal: 'editorial',
  modern: 'friendly',
  classic: 'editorial',
};

export const normalizePreset = (raw: string | undefined): ThemePreset => {
  if (!raw) return 'clean';
  if (raw in PRESETS) return raw as ThemePreset;
  return LEGACY_PRESET_ALIAS[raw] ?? 'clean';
};

/**
 * Resolve a ThemeConfig to a flat record of CSS variable name → value.
 * Apply to a form root via `style={resolveTheme(theme)}` in React, or by setting
 * the variables on the `.sf-form` element in vanilla JS.
 */
export const resolveTheme = (theme: ThemeConfig | undefined): Record<string, string> => {
  const preset = normalizePreset(theme?.preset);
  const base = { ...(PRESETS[preset]?.vars ?? PRESETS.clean.vars) };

  // Layout-token defaults that aren't part of presets (yet). Adding them here so
  // the new style controls always have something to override.
  const layoutDefaults: Record<string, string> = {
    '--sf-font-size': FONT_SCALE.md.base,
    '--sf-label-size': FONT_SCALE.md.label,
    '--sf-field-gap': FIELD_GAP.normal,
    '--sf-label-display': 'block',
    '--sf-label-margin': '0 0 4px 0',
    '--sf-input-padding': '8px 12px',
    '--sf-input-style': 'outline',
    '--sf-btn-bg': 'var(--sf-primary)',
    '--sf-btn-color': 'var(--sf-primary-contrast)',
    '--sf-btn-border': 'transparent',
    '--sf-btn-padding': '8px 20px',
    '--sf-btn-width': 'auto',
    '--sf-btn-align': 'flex-start',
    '--sf-form-max-width': FORM_WIDTH.normal,
    '--sf-form-padding': FORM_PADDING.normal,
    '--sf-input-weight': '400',
    '--sf-label-weight': '600',
  };
  Object.assign(base, layoutDefaults);

  const overrides: Record<string, string> = {};

  // Color overrides
  if (theme?.primaryColor) {
    overrides['--sf-primary'] = theme.primaryColor;
    overrides['--sf-border-focus'] = theme.primaryColor;
  }
  if (theme?.backgroundColor) overrides['--sf-bg'] = theme.backgroundColor;
  if (theme?.textColor) overrides['--sf-text'] = theme.textColor;
  if (theme?.inputBackgroundColor) overrides['--sf-input-bg'] = theme.inputBackgroundColor;

  // Radius
  if (theme?.borderRadius) overrides['--sf-radius'] = RADIUS[theme.borderRadius];

  // Font family (accept a friendly preset name or a raw font stack)
  if (theme?.fontFamily) {
    overrides['--sf-font'] =
      FONT_FAMILY[theme.fontFamily as FontFamily] ?? theme.fontFamily;
  }

  // Font scale
  if (theme?.fontScale) {
    overrides['--sf-font-size'] = FONT_SCALE[theme.fontScale].base;
    overrides['--sf-label-size'] = FONT_SCALE[theme.fontScale].label;
  }

  // Field spacing
  if (theme?.fieldSpacing) overrides['--sf-field-gap'] = FIELD_GAP[theme.fieldSpacing];

  // Label position (above = block label on its own line; inline = side-by-side)
  if (theme?.labelPosition === 'inline') {
    overrides['--sf-label-display'] = 'inline-block';
    overrides['--sf-label-margin'] = '0 12px 0 0';
  }

  // Input style
  switch (theme?.inputStyle) {
    case 'underline':
      overrides['--sf-input-bg'] = 'transparent';
      overrides['--sf-input-radius'] = '0px';
      overrides['--sf-input-border-top'] = '0';
      overrides['--sf-input-border-left'] = '0';
      overrides['--sf-input-border-right'] = '0';
      overrides['--sf-input-padding'] = '8px 2px';
      break;
    case 'filled':
      overrides['--sf-input-bg'] = 'rgba(0,0,0,0.04)';
      overrides['--sf-input-border-color'] = 'transparent';
      break;
    // 'outline' uses default border setup
  }

  // Button style
  if (theme?.buttonStyle === 'outline') {
    overrides['--sf-btn-bg'] = 'transparent';
    overrides['--sf-btn-color'] = 'var(--sf-primary)';
    overrides['--sf-btn-border'] = 'var(--sf-primary)';
  } else if (theme?.buttonStyle === 'ghost') {
    overrides['--sf-btn-bg'] = 'transparent';
    overrides['--sf-btn-color'] = 'var(--sf-primary)';
    overrides['--sf-btn-border'] = 'transparent';
  }

  // Submit button fine overrides (these win over buttonStyle's defaults)
  if (theme?.buttonBg) overrides['--sf-btn-bg'] = theme.buttonBg;
  if (theme?.buttonColor) overrides['--sf-btn-color'] = theme.buttonColor;
  if (theme?.buttonBorderColor) overrides['--sf-btn-border'] = theme.buttonBorderColor;
  if (theme?.buttonBorderWidth)
    overrides['--sf-btn-border-width'] = BUTTON_BORDER_WIDTH[theme.buttonBorderWidth];
  if (theme?.buttonPadding) overrides['--sf-btn-padding'] = BUTTON_PADDING[theme.buttonPadding];
  if (theme?.buttonSize) overrides['--sf-btn-font-size'] = BUTTON_FONT_SIZE[theme.buttonSize];
  if (theme?.buttonBold) overrides['--sf-btn-font-weight'] = '700';

  // Button width (auto / full)
  if (theme?.buttonWidth === 'full') overrides['--sf-btn-width'] = '100%';

  // Button alignment (left / center / right)
  if (theme?.buttonAlign === 'center') overrides['--sf-btn-align'] = 'center';
  else if (theme?.buttonAlign === 'right') overrides['--sf-btn-align'] = 'flex-end';
  else if (theme?.buttonAlign === 'left') overrides['--sf-btn-align'] = 'flex-start';

  // Form width
  if (theme?.formWidth) overrides['--sf-form-max-width'] = FORM_WIDTH[theme.formWidth];

  // Form padding
  if (theme?.formPadding) overrides['--sf-form-padding'] = FORM_PADDING[theme.formPadding];

  // Shadow toggle (overrides preset's shadow only when explicitly set)
  if (theme?.shadow === false) overrides['--sf-shadow'] = 'none';

  return { ...base, ...overrides };
};

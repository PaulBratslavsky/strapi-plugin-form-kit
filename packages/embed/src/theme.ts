/**
 * Theme resolution for the embed snippet. Mirrors the plugin's `themes.ts` —
 * keep the variable names and preset values in sync.
 *
 * The form's `settings.theme` resolves to a flat record of CSS variable values,
 * which we set as inline styles on the rendered `.sf-form` root.
 */
import type { ThemeConfig } from './types';

const RADIUS = {
  none: '0px',
  sm: '4px',
  md: '8px',
  lg: '12px',
  pill: '999px',
} as const;

type Preset = NonNullable<ThemeConfig['preset']>;

const PRESETS: Record<Preset, Record<string, string>> = {
  clean: {
    '--sf-primary': '#4945ff',
    '--sf-primary-contrast': '#ffffff',
    '--sf-text': '#1a1a2e',
    '--sf-muted': '#666687',
    '--sf-bg': '#ffffff',
    '--sf-input-bg': '#ffffff',
    '--sf-border': '#d9d8ff',
    '--sf-border-focus': '#4945ff',
    '--sf-border-width': '1px',
    '--sf-error': '#d02b20',
    '--sf-error-bg': '#fcecea',
    '--sf-success': '#328048',
    '--sf-success-bg': '#eafbe7',
    '--sf-radius': '8px',
    '--sf-shadow': '0 1px 2px rgba(33, 33, 52, 0.04)',
    '--sf-font': '"Inter", system-ui, -apple-system, sans-serif',
  },
  editorial: {
    '--sf-primary': '#1a1a1a',
    '--sf-primary-contrast': '#ffffff',
    '--sf-text': '#1a1a1a',
    '--sf-muted': '#6b6b6b',
    '--sf-bg': '#fafaf7',
    '--sf-input-bg': '#fafaf7',
    '--sf-border': '#1a1a1a',
    '--sf-border-focus': '#1a1a1a',
    '--sf-border-width': '1px',
    '--sf-error': '#9c1f1f',
    '--sf-error-bg': '#fafaf7',
    '--sf-success': '#1a1a1a',
    '--sf-success-bg': '#fafaf7',
    '--sf-radius': '0px',
    '--sf-shadow': 'none',
    '--sf-font': '"Source Serif Pro", Georgia, "Times New Roman", serif',
  },
  friendly: {
    '--sf-primary': '#f97066',
    '--sf-primary-contrast': '#ffffff',
    '--sf-text': '#3a2e2e',
    '--sf-muted': '#8c7676',
    '--sf-bg': '#fff7f3',
    '--sf-input-bg': '#ffffff',
    '--sf-border': '#f5d6cf',
    '--sf-border-focus': '#f97066',
    '--sf-border-width': '1.5px',
    '--sf-error': '#c4321f',
    '--sf-error-bg': '#fdecea',
    '--sf-success': '#107a47',
    '--sf-success-bg': '#e3f7ec',
    '--sf-radius': '16px',
    '--sf-shadow': '0 4px 12px rgba(249, 112, 102, 0.12)',
    '--sf-font': '"Nunito", "Inter", system-ui, sans-serif',
  },
  bold: {
    '--sf-primary': '#ffc83d',
    '--sf-primary-contrast': '#1a1a1a',
    '--sf-text': '#1a1a1a',
    '--sf-muted': '#4a4a4a',
    '--sf-bg': '#fffdf0',
    '--sf-input-bg': '#ffffff',
    '--sf-border': '#1a1a1a',
    '--sf-border-focus': '#1a1a1a',
    '--sf-border-width': '3px',
    '--sf-error': '#d02b20',
    '--sf-error-bg': '#ffe5e5',
    '--sf-success': '#1a1a1a',
    '--sf-success-bg': '#e5ffd9',
    '--sf-radius': '4px',
    '--sf-shadow': '4px 4px 0 #1a1a1a',
    '--sf-font': '"Space Grotesk", "Inter", system-ui, sans-serif',
  },
};

const FONT_FAMILY = {
  system: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  sans: '"Inter", system-ui, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
} as const;

const FONT_SCALE = {
  sm: { base: '13px', label: '0.8125rem' },
  md: { base: '15px', label: '0.875rem' },
  lg: { base: '17px', label: '0.9375rem' },
} as const;

const FIELD_GAP = {
  compact: '12px',
  normal: '20px',
  relaxed: '32px',
} as const;

const FORM_WIDTH = {
  narrow: '420px',
  normal: '560px',
  wide: '720px',
  full: '100%',
} as const;

const FORM_PADDING = {
  compact: '16px',
  normal: '24px',
  spacious: '40px',
} as const;

const BUTTON_BORDER_WIDTH = {
  none: '0',
  thin: '1px',
  regular: '2px',
  thick: '3px',
} as const;

const BUTTON_PADDING = {
  compact: '6px 14px',
  normal: '8px 20px',
  large: '12px 28px',
} as const;

const BUTTON_FONT_SIZE = {
  sm: '13px',
  md: '15px',
  lg: '17px',
} as const;

// Legacy preset names users may still have stored from older versions of the
// plugin. Admin's normalizePreset handles the alias; mirror it here so the
// embed doesn't fall through to the default.
const PRESET_ALIASES: Record<string, Preset> = {
  default: 'clean',
};

export const resolveTheme = (theme: ThemeConfig | undefined): Record<string, string> => {
  const rawPreset = (theme?.preset ?? 'clean') as string;
  const preset = (PRESET_ALIASES[rawPreset] ?? rawPreset) as Preset;
  const base = { ...(PRESETS[preset] ?? PRESETS.clean) };

  // Layout-token defaults — applied on top of preset so new style controls always have something to override.
  Object.assign(base, {
    '--sf-font-size': FONT_SCALE.md.base,
    '--sf-label-size': FONT_SCALE.md.label,
    '--sf-field-gap': FIELD_GAP.normal,
    '--sf-label-display': 'block',
    '--sf-label-margin': '0 0 4px 0',
    '--sf-input-padding': '8px 12px',
    '--sf-input-border-color': base['--sf-border'],
    '--sf-btn-bg': 'var(--sf-primary)',
    '--sf-btn-color': 'var(--sf-primary-contrast)',
    '--sf-btn-border': 'transparent',
    '--sf-btn-padding': '8px 20px',
    '--sf-btn-width': 'auto',
    '--sf-btn-align': 'flex-start',
    '--sf-form-max-width': FORM_WIDTH.normal,
    '--sf-form-padding': FORM_PADDING.normal,
  });

  const overrides: Record<string, string> = {};

  if (theme?.primaryColor) {
    overrides['--sf-primary'] = theme.primaryColor;
    overrides['--sf-border-focus'] = theme.primaryColor;
  }
  if (theme?.backgroundColor) overrides['--sf-bg'] = theme.backgroundColor;
  if (theme?.textColor) overrides['--sf-text'] = theme.textColor;
  if (theme?.borderRadius)
    overrides['--sf-radius'] = RADIUS[theme.borderRadius as keyof typeof RADIUS];

  if (theme?.fontFamily) {
    overrides['--sf-font'] =
      (FONT_FAMILY as Record<string, string>)[theme.fontFamily] ?? theme.fontFamily;
  }
  if (theme?.fontScale) {
    overrides['--sf-font-size'] = FONT_SCALE[theme.fontScale].base;
    overrides['--sf-label-size'] = FONT_SCALE[theme.fontScale].label;
  }
  if (theme?.fieldSpacing) overrides['--sf-field-gap'] = FIELD_GAP[theme.fieldSpacing];

  if (theme?.labelPosition === 'inline') {
    overrides['--sf-label-display'] = 'inline-block';
    overrides['--sf-label-margin'] = '0 12px 0 0';
  }

  switch (theme?.inputStyle) {
    case 'underline':
      overrides['--sf-input-bg'] = 'transparent';
      overrides['--sf-input-radius'] = '0px';
      overrides['--sf-input-padding'] = '8px 2px';
      // Borders are still set by the standard rules; underline-only handled via dedicated CSS below.
      break;
    case 'filled':
      overrides['--sf-input-bg'] = 'rgba(0,0,0,0.04)';
      overrides['--sf-input-border-color'] = 'transparent';
      break;
  }

  if (theme?.buttonStyle === 'outline') {
    overrides['--sf-btn-bg'] = 'transparent';
    overrides['--sf-btn-color'] = 'var(--sf-primary)';
    overrides['--sf-btn-border'] = 'var(--sf-primary)';
  } else if (theme?.buttonStyle === 'ghost') {
    overrides['--sf-btn-bg'] = 'transparent';
    overrides['--sf-btn-color'] = 'var(--sf-primary)';
    overrides['--sf-btn-border'] = 'transparent';
  }

  // Fine submit-button overrides — same set the admin's resolveTheme writes.
  if (theme?.buttonBg) overrides['--sf-btn-bg'] = theme.buttonBg;
  if (theme?.buttonColor) overrides['--sf-btn-color'] = theme.buttonColor;
  if (theme?.buttonBorderColor) overrides['--sf-btn-border'] = theme.buttonBorderColor;
  if (theme?.buttonBorderWidth)
    overrides['--sf-btn-border-width'] =
      BUTTON_BORDER_WIDTH[theme.buttonBorderWidth as keyof typeof BUTTON_BORDER_WIDTH];
  if (theme?.buttonPadding)
    overrides['--sf-btn-padding'] =
      BUTTON_PADDING[theme.buttonPadding as keyof typeof BUTTON_PADDING];
  if (theme?.buttonSize)
    overrides['--sf-btn-font-size'] =
      BUTTON_FONT_SIZE[theme.buttonSize as keyof typeof BUTTON_FONT_SIZE];
  if (theme?.buttonBold) overrides['--sf-btn-font-weight'] = '700';

  if (theme?.buttonWidth === 'full') overrides['--sf-btn-width'] = '100%';
  if (theme?.buttonAlign === 'center') overrides['--sf-btn-align'] = 'center';
  else if (theme?.buttonAlign === 'right') overrides['--sf-btn-align'] = 'flex-end';

  if (theme?.formWidth) overrides['--sf-form-max-width'] = FORM_WIDTH[theme.formWidth];
  if (theme?.formPadding) overrides['--sf-form-padding'] = FORM_PADDING[theme.formPadding];

  if (theme?.shadow === false) overrides['--sf-shadow'] = 'none';

  return { ...base, ...overrides };
};

export const applyThemeToElement = (el: HTMLElement, theme: ThemeConfig | undefined) => {
  const vars = resolveTheme(theme);
  for (const [k, v] of Object.entries(vars)) {
    el.style.setProperty(k, v);
  }
};

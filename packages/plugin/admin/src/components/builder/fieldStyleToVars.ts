/**
 * Resolves a FieldStyle into inline CSS variable overrides for a single field
 * wrapper. Mirrors `@strapi-forms/embed/src/field-style.ts` — keep in sync.
 */
import type { FieldStyle } from '../../hooks/useFormSchema';

const BORDER_WIDTH = {
  none: '0',
  thin: '1px',
  regular: '2px',
  thick: '3px',
} as const;

const FONT_SIZE = {
  sm: { base: '13px', label: '0.8125rem' },
  md: { base: '15px', label: '0.875rem' },
  lg: { base: '17px', label: '0.9375rem' },
} as const;

const PADDING = {
  compact: '6px 10px',
  normal: '8px 12px',
  large: '12px 16px',
} as const;

export const fieldStyleToVars = (style: FieldStyle | undefined): React.CSSProperties => {
  if (!style) return {};
  const vars: Record<string, string> = {};

  if (style.accentColor) {
    vars['--sf-primary'] = style.accentColor;
    vars['--sf-border-focus'] = style.accentColor;
  }
  if (style.borderColor) vars['--sf-input-border-color'] = style.borderColor;
  if (style.inputBg) vars['--sf-input-bg'] = style.inputBg;
  if (style.borderWidth) vars['--sf-border-width'] = BORDER_WIDTH[style.borderWidth];
  if (style.inputSize) vars['--sf-font-size'] = FONT_SIZE[style.inputSize].base;
  if (style.labelSize) vars['--sf-label-size'] = FONT_SIZE[style.labelSize].label;
  if (style.inputBold) vars['--sf-input-weight'] = '700';
  if (style.labelBold) vars['--sf-label-weight'] = '700';
  if (style.padding) vars['--sf-input-padding'] = PADDING[style.padding];

  return vars as React.CSSProperties;
};

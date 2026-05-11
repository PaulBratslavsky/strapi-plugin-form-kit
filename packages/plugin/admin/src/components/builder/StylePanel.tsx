import styled from 'styled-components';
import { Box, Typography, Field, Button, Toggle } from '@strapi/design-system';
import { ColorPicker } from './ColorPicker';
import {
  PRESETS,
  PRESET_ORDER,
  RADIUS,
  FONT_FAMILY,
  normalizePreset,
  type ThemeConfig,
  type ThemePreset,
  type BorderRadius,
  type FontFamily,
  type FontScale,
  type LabelPosition,
  type InputStyle,
  type ButtonStyle,
  type FieldSpacing,
} from './themes';

type Props = {
  theme: ThemeConfig | undefined;
  onChange: (theme: ThemeConfig) => void;
};

// ---------- shared styled atoms ----------

const Section = styled.div`
  margin-bottom: 20px;

  &:last-child {
    margin-bottom: 0;
  }
`;

const SectionHeader = styled.div`
  margin-bottom: 10px;
`;

const SectionTitle = styled.span`
  display: block;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: ${({ theme }) => theme?.colors?.neutral500 ?? '#8e8ea9'};
`;

const SectionHint = styled.span`
  display: block;
  margin-top: 2px;
  font-size: 0.75rem;
  color: ${({ theme }) => theme?.colors?.neutral500 ?? '#8e8ea9'};
`;

const PresetGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
`;

const PresetCard = styled.button<{ $selected: boolean }>`
  display: block;
  width: 100%;
  text-align: left;
  padding: 10px;
  cursor: pointer;
  background: ${({ theme }) => theme?.colors?.neutral0 ?? '#fff'};
  border: 2px solid
    ${({ $selected, theme }) =>
      $selected ? theme?.colors?.primary600 ?? '#4945ff' : theme?.colors?.neutral200 ?? '#dcdce4'};
  border-radius: 8px;
  transition: border-color 120ms ease;

  &:hover {
    border-color: ${({ theme }) => theme?.colors?.primary600 ?? '#4945ff'};
  }
`;

const PresetSwatches = styled.div<{ $vars: Record<string, string> }>`
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 6px;

  & > * {
    height: 22px;
    border-radius: ${({ $vars }) => $vars['--sf-radius']};
    border: ${({ $vars }) =>
      `${$vars['--sf-border-width']} solid ${$vars['--sf-border']}`};
  }
`;

const Swatch = styled.span<{ $color: string; $width: string }>`
  display: inline-block;
  width: ${({ $width }) => $width};
  background: ${({ $color }) => $color};
`;

const FauxButton = styled.span<{ $vars: Record<string, string> }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 22px;
  padding: 0 8px;
  font-size: 0.65rem;
  font-weight: 600;
  background: ${({ $vars }) => $vars['--sf-primary']};
  color: ${({ $vars }) => $vars['--sf-primary-contrast']};
  border-radius: ${({ $vars }) => $vars['--sf-radius']};
  border: none !important;
`;

const SegGroup = styled.div<{ $cols?: number }>`
  display: grid;
  grid-template-columns: repeat(${({ $cols }) => $cols ?? 3}, 1fr);
  gap: 6px;
`;

const SegButton = styled.button<{ $selected: boolean }>`
  border: 1px solid
    ${({ $selected, theme }) =>
      $selected ? theme?.colors?.primary600 ?? '#4945ff' : theme?.colors?.neutral200 ?? '#dcdce4'};
  background: ${({ $selected, theme }) =>
    $selected ? theme?.colors?.primary100 ?? '#f0f0ff' : theme?.colors?.neutral0 ?? '#fff'};
  color: ${({ $selected, theme }) =>
    $selected ? theme?.colors?.primary700 ?? '#271fe0' : theme?.colors?.neutral800 ?? '#32324d'};
  cursor: pointer;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 500;
  transition: border-color 120ms ease, background 120ms ease;

  &:hover {
    border-color: ${({ theme }) => theme?.colors?.primary600 ?? '#4945ff'};
  }
`;

const RadiusPreview = styled.span<{ $size: string }>`
  width: 24px;
  height: 24px;
  background: ${({ theme }) => theme?.colors?.neutral400 ?? '#a5a5ba'};
  border-radius: ${({ $size }) => $size};
  display: inline-block;
`;

const SwatchPreview = styled.span<{ $bg: string; $border: string; $radius: string }>`
  width: 28px;
  height: 18px;
  background: ${({ $bg }) => $bg};
  border: 1px solid ${({ $border }) => $border};
  border-radius: ${({ $radius }) => $radius};
  display: inline-block;
`;

const RowControl = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`;

const ColorSwatchInput = styled.input.attrs({ type: 'color' })`
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid ${({ theme }) => theme?.colors?.neutral200 ?? '#dcdce4'};
  border-radius: 6px;
  cursor: pointer;
  background: transparent;
`;

const ToggleRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  border: 1px solid ${({ theme }) => theme?.colors?.neutral200 ?? '#dcdce4'};
  border-radius: 8px;
  background: ${({ theme }) => theme?.colors?.neutral0 ?? '#fff'};
`;

const ToggleRowLabel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

// ---------- panel data ----------

const RADIUS_LABELS: Record<BorderRadius, string> = {
  none: 'None',
  sm: 'Small',
  md: 'Medium',
  lg: 'Large',
  pill: 'Pill',
};

const RADIUS_ORDER: BorderRadius[] = ['none', 'sm', 'md', 'lg', 'pill'];

const FONT_LABELS: Record<FontFamily, string> = {
  system: 'System',
  sans: 'Sans',
  serif: 'Serif',
  mono: 'Mono',
};

const FONT_PREVIEW_STYLE: Record<FontFamily, React.CSSProperties> = {
  system: { fontFamily: FONT_FAMILY.system },
  sans: { fontFamily: FONT_FAMILY.sans },
  serif: { fontFamily: FONT_FAMILY.serif },
  mono: { fontFamily: FONT_FAMILY.mono },
};

const FONT_ORDER: FontFamily[] = ['system', 'sans', 'serif', 'mono'];

const SCALE_LABELS: Record<FontScale, string> = {
  sm: 'Small',
  md: 'Medium',
  lg: 'Large',
};

const LABEL_POS_OPTIONS: Array<{ value: LabelPosition; label: string }> = [
  { value: 'above', label: 'Above' },
  { value: 'inline', label: 'Inline' },
];

const INPUT_STYLE_OPTIONS: Array<{ value: InputStyle; label: string }> = [
  { value: 'outline', label: 'Outline' },
  { value: 'filled', label: 'Filled' },
  { value: 'underline', label: 'Underline' },
];

const BUTTON_STYLE_OPTIONS: Array<{ value: ButtonStyle; label: string }> = [
  { value: 'filled', label: 'Filled' },
  { value: 'outline', label: 'Outline' },
  { value: 'ghost', label: 'Ghost' },
];

const SPACING_OPTIONS: Array<{ value: FieldSpacing; label: string }> = [
  { value: 'compact', label: 'Compact' },
  { value: 'normal', label: 'Normal' },
  { value: 'relaxed', label: 'Relaxed' },
];

// ---------- panel ----------

export const StylePanel = ({ theme, onChange }: Props) => {
  // Normalize preset so legacy values ('default', 'minimal', 'modern', 'classic')
  // don't crash PRESETS[...] accesses below.
  const current: ThemeConfig = {
    ...(theme ?? {}),
    preset: normalizePreset(theme?.preset),
  };
  const setPreset = (preset: ThemePreset) => onChange({ ...current, preset });
  const update = (patch: Partial<ThemeConfig>) => onChange({ ...current, ...patch });
  const resolvedPrimary = current.primaryColor ?? PRESETS[current.preset].vars['--sf-primary'];

  const hasOverrides =
    !!current.primaryColor ||
    !!current.borderRadius ||
    !!current.fontFamily ||
    !!current.fontScale ||
    !!current.labelPosition ||
    !!current.inputStyle ||
    !!current.buttonStyle ||
    !!current.buttonWidth ||
    !!current.buttonAlign ||
    !!current.fieldSpacing ||
    !!current.formWidth ||
    !!current.formPadding ||
    current.shadow !== undefined ||
    !!current.backgroundColor ||
    !!current.textColor;

  return (
    <Box padding={4}>
      {/* ---------- Theme preset ---------- */}
      <Section>
        <SectionHeader>
          <SectionTitle>Theme preset</SectionTitle>
          <SectionHint>Pick a starting point. Override individual properties below.</SectionHint>
        </SectionHeader>
        <PresetGrid>
          {PRESET_ORDER.map((name) => {
            const def = PRESETS[name];
            return (
              <PresetCard
                key={name}
                type="button"
                $selected={current.preset === name}
                onClick={() => setPreset(name)}
                aria-pressed={current.preset === name}
              >
                <PresetSwatches $vars={def.vars}>
                  <Swatch $color={def.vars['--sf-bg']} $width="40%" />
                  <FauxButton $vars={def.vars}>SEND</FauxButton>
                </PresetSwatches>
                <Typography variant="omega" fontWeight="bold" tag="div">
                  {def.label}
                </Typography>
                <Typography variant="pi" textColor="neutral600" tag="div">
                  {def.description}
                </Typography>
              </PresetCard>
            );
          })}
        </PresetGrid>
      </Section>

      {/* ---------- Primary color ---------- */}
      <Section>
        <SectionHeader>
          <SectionTitle>Primary color</SectionTitle>
          <SectionHint>Buttons, focus rings, and accents.</SectionHint>
        </SectionHeader>
        <ColorPicker
          value={resolvedPrimary}
          placeholder={PRESETS[current.preset].vars['--sf-primary']}
          onChange={(hex) => update({ primaryColor: hex })}
          onReset={() => update({ primaryColor: undefined })}
          showReset={!!current.primaryColor}
        />
      </Section>

      {/* ---------- Corner radius ---------- */}
      <Section>
        <SectionHeader>
          <SectionTitle>Corner radius</SectionTitle>
        </SectionHeader>
        <SegGroup $cols={5}>
          {RADIUS_ORDER.map((r) => {
            const selected =
              current.borderRadius === r ||
              (!current.borderRadius && PRESETS[current.preset].vars['--sf-radius'] === RADIUS[r]);
            return (
              <SegButton
                key={r}
                type="button"
                $selected={selected}
                onClick={() => update({ borderRadius: r })}
              >
                <RadiusPreview $size={RADIUS[r]} />
                {RADIUS_LABELS[r]}
              </SegButton>
            );
          })}
        </SegGroup>
      </Section>

      {/* ---------- Typography ---------- */}
      <Section>
        <SectionHeader>
          <SectionTitle>Font family</SectionTitle>
        </SectionHeader>
        <SegGroup $cols={4}>
          {FONT_ORDER.map((f) => (
            <SegButton
              key={f}
              type="button"
              $selected={current.fontFamily === f}
              onClick={() => update({ fontFamily: f })}
            >
              <span style={{ ...FONT_PREVIEW_STYLE[f], fontSize: '1rem', fontWeight: 700 }}>
                Aa
              </span>
              {FONT_LABELS[f]}
            </SegButton>
          ))}
        </SegGroup>
      </Section>

      <Section>
        <SectionHeader>
          <SectionTitle>Font size</SectionTitle>
        </SectionHeader>
        <SegGroup $cols={3}>
          {(['sm', 'md', 'lg'] as FontScale[]).map((s) => (
            <SegButton
              key={s}
              type="button"
              $selected={(current.fontScale ?? 'md') === s}
              onClick={() => update({ fontScale: s })}
            >
              <span
                style={{
                  fontSize: s === 'sm' ? '0.75rem' : s === 'md' ? '0.95rem' : '1.1rem',
                  fontWeight: 600,
                }}
              >
                Aa
              </span>
              {SCALE_LABELS[s]}
            </SegButton>
          ))}
        </SegGroup>
      </Section>

      {/* ---------- Layout ---------- */}
      <Section>
        <SectionHeader>
          <SectionTitle>Label position</SectionTitle>
        </SectionHeader>
        <SegGroup $cols={2}>
          {LABEL_POS_OPTIONS.map((o) => (
            <SegButton
              key={o.value}
              type="button"
              $selected={(current.labelPosition ?? 'above') === o.value}
              onClick={() => update({ labelPosition: o.value })}
            >
              {o.label}
            </SegButton>
          ))}
        </SegGroup>
      </Section>

      <Section>
        <SectionHeader>
          <SectionTitle>Field spacing</SectionTitle>
        </SectionHeader>
        <SegGroup $cols={3}>
          {SPACING_OPTIONS.map((o) => (
            <SegButton
              key={o.value}
              type="button"
              $selected={(current.fieldSpacing ?? 'normal') === o.value}
              onClick={() => update({ fieldSpacing: o.value })}
            >
              {o.label}
            </SegButton>
          ))}
        </SegGroup>
      </Section>

      {/* ---------- Input style ---------- */}
      <Section>
        <SectionHeader>
          <SectionTitle>Input style</SectionTitle>
        </SectionHeader>
        <SegGroup $cols={3}>
          {INPUT_STYLE_OPTIONS.map((o) => (
            <SegButton
              key={o.value}
              type="button"
              $selected={(current.inputStyle ?? 'outline') === o.value}
              onClick={() => update({ inputStyle: o.value })}
            >
              {o.label}
            </SegButton>
          ))}
        </SegGroup>
      </Section>

      {/* ---------- Button style ---------- */}
      <Section>
        <SectionHeader>
          <SectionTitle>Submit button</SectionTitle>
        </SectionHeader>
        <SegGroup $cols={3}>
          {BUTTON_STYLE_OPTIONS.map((o) => (
            <SegButton
              key={o.value}
              type="button"
              $selected={(current.buttonStyle ?? 'filled') === o.value}
              onClick={() => update({ buttonStyle: o.value })}
            >
              {o.label}
            </SegButton>
          ))}
        </SegGroup>
      </Section>

      {/* ---------- Button width ---------- */}
      <Section>
        <SectionHeader>
          <SectionTitle>Button width</SectionTitle>
        </SectionHeader>
        <SegGroup $cols={2}>
          {(['auto', 'full'] as const).map((w) => (
            <SegButton
              key={w}
              type="button"
              $selected={(current.buttonWidth ?? 'auto') === w}
              onClick={() => update({ buttonWidth: w })}
            >
              {w === 'auto' ? 'Auto' : 'Full width'}
            </SegButton>
          ))}
        </SegGroup>
      </Section>

      {/* ---------- Button alignment ---------- */}
      <Section>
        <SectionHeader>
          <SectionTitle>Button alignment</SectionTitle>
        </SectionHeader>
        <SegGroup $cols={3}>
          {(['left', 'center', 'right'] as const).map((a) => (
            <SegButton
              key={a}
              type="button"
              $selected={(current.buttonAlign ?? 'left') === a}
              onClick={() => update({ buttonAlign: a })}
            >
              {a[0]?.toUpperCase() + a.slice(1)}
            </SegButton>
          ))}
        </SegGroup>
      </Section>

      {/* ---------- Form width ---------- */}
      <Section>
        <SectionHeader>
          <SectionTitle>Form width</SectionTitle>
        </SectionHeader>
        <SegGroup $cols={4}>
          {(['narrow', 'normal', 'wide', 'full'] as const).map((w) => (
            <SegButton
              key={w}
              type="button"
              $selected={(current.formWidth ?? 'normal') === w}
              onClick={() => update({ formWidth: w })}
            >
              {w[0]?.toUpperCase() + w.slice(1)}
            </SegButton>
          ))}
        </SegGroup>
      </Section>

      {/* ---------- Form padding ---------- */}
      <Section>
        <SectionHeader>
          <SectionTitle>Form padding</SectionTitle>
        </SectionHeader>
        <SegGroup $cols={3}>
          {(['compact', 'normal', 'spacious'] as const).map((p) => (
            <SegButton
              key={p}
              type="button"
              $selected={(current.formPadding ?? 'normal') === p}
              onClick={() => update({ formPadding: p })}
            >
              {p[0]?.toUpperCase() + p.slice(1)}
            </SegButton>
          ))}
        </SegGroup>
      </Section>

      {/* ---------- Background color ---------- */}
      <Section>
        <SectionHeader>
          <SectionTitle>Background color</SectionTitle>
          <SectionHint>The form's page background.</SectionHint>
        </SectionHeader>
        <ColorPicker
          value={current.backgroundColor ?? PRESETS[current.preset].vars['--sf-bg']}
          placeholder={PRESETS[current.preset].vars['--sf-bg']}
          onChange={(hex) => update({ backgroundColor: hex })}
          onReset={() => update({ backgroundColor: undefined })}
          showReset={!!current.backgroundColor}
        />
      </Section>

      {/* ---------- Text color ---------- */}
      <Section>
        <SectionHeader>
          <SectionTitle>Text color</SectionTitle>
          <SectionHint>Labels, help text, and field values.</SectionHint>
        </SectionHeader>
        <ColorPicker
          value={current.textColor ?? PRESETS[current.preset].vars['--sf-text']}
          placeholder={PRESETS[current.preset].vars['--sf-text']}
          onChange={(hex) => update({ textColor: hex })}
          onReset={() => update({ textColor: undefined })}
          showReset={!!current.textColor}
        />
      </Section>

      {/* ---------- Shadow toggle ---------- */}
      <Section>
        <ToggleRow>
          <ToggleRowLabel>
            <Typography variant="omega" fontWeight="bold" tag="div">
              Shadow
            </Typography>
            <Typography variant="pi" textColor="neutral600" tag="div">
              Use the preset's shadow ({PRESETS[current.preset].vars['--sf-shadow'] === 'none' ? 'none' : 'on'})
            </Typography>
          </ToggleRowLabel>
          <Toggle
            aria-label="Shadow"
            checked={current.shadow !== false}
            onChange={() =>
              update({ shadow: current.shadow === false ? undefined : false })
            }
          />
        </ToggleRow>
      </Section>

      {/* ---------- Reset all ---------- */}
      {hasOverrides && (
        <Section>
          <Button
            variant="tertiary"
            size="S"
            onClick={() => onChange({ preset: current.preset })}
          >
            Reset overrides to preset
          </Button>
        </Section>
      )}
    </Box>
  );
};

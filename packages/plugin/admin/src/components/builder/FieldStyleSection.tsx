/**
 * Per-field style overrides (width, hide label, label alignment, accent color).
 * Used inside FieldConfigPanel (Build mode) and the Style-mode click-to-edit drawer.
 */
import styled from 'styled-components';
import { Box, Typography, Toggle, Flex } from '@strapi/design-system';
import { ColorPicker } from './ColorPicker';
import type { Field as FieldType, FieldStyle, FieldWidth } from '../../hooks/useFormSchema';

type Props = {
  field: FieldType;
  onChange: (patch: Partial<FieldType>) => void;
};

const SectionTitle = styled.span`
  display: block;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: ${({ theme }) => theme?.colors?.neutral500 ?? '#8e8ea9'};
  margin-bottom: 8px;
`;

const SectionHint = styled.span`
  display: block;
  font-size: 0.75rem;
  color: ${({ theme }) => theme?.colors?.neutral500 ?? '#8e8ea9'};
  margin-bottom: 8px;
`;

const SegGroup = styled.div<{ $cols: number }>`
  display: grid;
  grid-template-columns: repeat(${({ $cols }) => $cols}, 1fr);
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
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 500;
  transition: border-color 120ms ease, background 120ms ease;

  &:hover {
    border-color: ${({ theme }) => theme?.colors?.primary600 ?? '#4945ff'};
  }
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

const WIDTH_OPTS: Array<{ value: FieldWidth; label: string }> = [
  { value: 'full', label: 'Full' },
  { value: 'two-thirds', label: '2/3' },
  { value: 'half', label: '1/2' },
  { value: 'third', label: '1/3' },
];

const LABEL_OPTS: Array<{ value: 'above' | 'inline'; label: string }> = [
  { value: 'above', label: 'Above' },
  { value: 'inline', label: 'Inline' },
];

export const FieldStyleSection = ({ field, onChange }: Props) => {
  const style: FieldStyle = field.style ?? {};
  const setStyle = (patch: Partial<FieldStyle>) => {
    const next = { ...style, ...patch };
    // Strip undefined keys so we don't persist a bunch of nulls.
    for (const k of Object.keys(next) as Array<keyof FieldStyle>) {
      if (next[k] === undefined) delete next[k];
    }
    onChange({ style: Object.keys(next).length === 0 ? undefined : next });
  };

  return (
    <Box>
      <Box marginBottom={4}>
        <SectionTitle>Field width</SectionTitle>
        <SectionHint>Use partial widths to build multi-column rows.</SectionHint>
        <SegGroup $cols={4}>
          {WIDTH_OPTS.map((o) => (
            <SegButton
              key={o.value}
              type="button"
              $selected={(style.width ?? 'full') === o.value}
              onClick={() => setStyle({ width: o.value })}
            >
              {o.label}
            </SegButton>
          ))}
        </SegGroup>
      </Box>

      <Box marginBottom={4}>
        <SectionTitle>Label position</SectionTitle>
        <SegGroup $cols={2}>
          {LABEL_OPTS.map((o) => (
            <SegButton
              key={o.value}
              type="button"
              $selected={(style.labelAlign ?? 'above') === o.value}
              onClick={() => setStyle({ labelAlign: o.value })}
            >
              {o.label}
            </SegButton>
          ))}
        </SegGroup>
      </Box>

      <Box marginBottom={4}>
        <ToggleRow>
          <Box flex="1">
            <Typography variant="omega" fontWeight="bold" tag="div">
              Hide label
            </Typography>
            <Typography variant="pi" textColor="neutral600" tag="div">
              Useful when the placeholder is self-explanatory.
            </Typography>
          </Box>
          <Toggle
            aria-label="Hide label"
            checked={!!style.hideLabel}
            onChange={() => setStyle({ hideLabel: style.hideLabel ? undefined : true })}
          />
        </ToggleRow>
      </Box>

      {/* ---------- Border ---------- */}
      <Box marginBottom={4}>
        <SectionTitle>Border thickness</SectionTitle>
        <SegGroup $cols={4}>
          {(['none', 'thin', 'regular', 'thick'] as const).map((b) => (
            <SegButton
              key={b}
              type="button"
              $selected={(style.borderWidth ?? 'thin') === b}
              onClick={() => setStyle({ borderWidth: b })}
            >
              {b[0]?.toUpperCase() + b.slice(1)}
            </SegButton>
          ))}
        </SegGroup>
      </Box>

      <Box marginBottom={4}>
        <SectionTitle>Border color</SectionTitle>
        <ColorPicker
          value={style.borderColor ?? '#c8c8c8'}
          placeholder="Inherit"
          onChange={(hex) => setStyle({ borderColor: hex })}
          onReset={() => setStyle({ borderColor: undefined })}
          showReset={!!style.borderColor}
        />
      </Box>

      <Box marginBottom={4}>
        <SectionTitle>Background color</SectionTitle>
        <SectionHint>The input's fill color.</SectionHint>
        <ColorPicker
          value={style.inputBg ?? '#ffffff'}
          placeholder="Inherit"
          onChange={(hex) => setStyle({ inputBg: hex })}
          onReset={() => setStyle({ inputBg: undefined })}
          showReset={!!style.inputBg}
        />
      </Box>

      <Box marginBottom={4}>
        <SectionTitle>Input padding</SectionTitle>
        <SegGroup $cols={3}>
          {(['compact', 'normal', 'large'] as const).map((p) => (
            <SegButton
              key={p}
              type="button"
              $selected={(style.padding ?? 'normal') === p}
              onClick={() => setStyle({ padding: p })}
            >
              {p[0]?.toUpperCase() + p.slice(1)}
            </SegButton>
          ))}
        </SegGroup>
      </Box>

      {/* ---------- Typography ---------- */}
      <Box marginBottom={4}>
        <SectionTitle>Label size</SectionTitle>
        <SegGroup $cols={3}>
          {(['sm', 'md', 'lg'] as const).map((s) => (
            <SegButton
              key={s}
              type="button"
              $selected={(style.labelSize ?? 'md') === s}
              onClick={() => setStyle({ labelSize: s })}
            >
              {s === 'sm' ? 'Small' : s === 'md' ? 'Medium' : 'Large'}
            </SegButton>
          ))}
        </SegGroup>
      </Box>

      <Box marginBottom={4}>
        <ToggleRow>
          <Box flex="1">
            <Typography variant="omega" fontWeight="bold" tag="div">
              Bold label
            </Typography>
          </Box>
          <Toggle
            aria-label="Bold label"
            checked={!!style.labelBold}
            onChange={() => setStyle({ labelBold: style.labelBold ? undefined : true })}
          />
        </ToggleRow>
      </Box>

      <Box marginBottom={4}>
        <SectionTitle>Input size</SectionTitle>
        <SegGroup $cols={3}>
          {(['sm', 'md', 'lg'] as const).map((s) => (
            <SegButton
              key={s}
              type="button"
              $selected={(style.inputSize ?? 'md') === s}
              onClick={() => setStyle({ inputSize: s })}
            >
              {s === 'sm' ? 'Small' : s === 'md' ? 'Medium' : 'Large'}
            </SegButton>
          ))}
        </SegGroup>
      </Box>

      <Box marginBottom={4}>
        <ToggleRow>
          <Box flex="1">
            <Typography variant="omega" fontWeight="bold" tag="div">
              Bold input text
            </Typography>
          </Box>
          <Toggle
            aria-label="Bold input"
            checked={!!style.inputBold}
            onChange={() => setStyle({ inputBold: style.inputBold ? undefined : true })}
          />
        </ToggleRow>
      </Box>

      <Box marginBottom={2}>
        <SectionTitle>Accent color</SectionTitle>
        <SectionHint>Overrides the form's primary color for this field only.</SectionHint>
        <ColorPicker
          value={style.accentColor ?? '#1f77ff'}
          placeholder="Inherit"
          onChange={(hex) => setStyle({ accentColor: hex })}
          onReset={() => setStyle({ accentColor: undefined })}
          showReset={!!style.accentColor}
        />
      </Box>
    </Box>
  );
};

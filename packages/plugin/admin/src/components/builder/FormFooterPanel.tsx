/**
 * Per-element style controls for the form footer (Submit + Reset row).
 * Backed by the global theme + settings since these are form-wide.
 */
import styled from 'styled-components';
import { Box, Typography, Field, Toggle } from '@strapi/design-system';
import type { Settings } from '../../hooks/useFormSchema';
import type {
  ThemeConfig,
  ButtonStyle,
  ButtonWidth,
  ButtonAlign,
  FieldBorderWidth,
  FieldPadding,
  FieldSize,
} from './themes';
import { ColorPicker } from './ColorPicker';

type Props = {
  theme: ThemeConfig | undefined;
  settings: Settings | undefined;
  onThemeChange: (theme: ThemeConfig) => void;
  onSettingsChange: (patch: Partial<Settings>) => void;
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

const SectionDivider = styled.div`
  border-top: 1px solid ${({ theme }) => theme?.colors?.neutral200 ?? '#dcdce4'};
  margin: 20px 0;
`;

export const FormFooterPanel = ({ theme, settings, onThemeChange, onSettingsChange }: Props) => {
  const currentTheme: ThemeConfig = theme ?? { preset: 'default' };
  const updateTheme = (patch: Partial<ThemeConfig>) => onThemeChange({ ...currentTheme, ...patch });
  const showReset = settings?.showReset ?? false;

  return (
    <Box>
      {/* ---------- Submit button ---------- */}
      <Box marginBottom={4}>
        <SectionTitle>Submit button label</SectionTitle>
        <Field.Root name="submitButtonLabel">
          <Field.Input
            value={settings?.submitButtonLabel ?? 'Submit'}
            placeholder="Submit"
            onChange={(e: any) => onSettingsChange({ submitButtonLabel: e.target.value })}
          />
        </Field.Root>
      </Box>

      <Box marginBottom={4}>
        <SectionTitle>Submit button style</SectionTitle>
        <SegGroup $cols={3}>
          {(['filled', 'outline', 'ghost'] as ButtonStyle[]).map((s) => (
            <SegButton
              key={s}
              type="button"
              $selected={(currentTheme.buttonStyle ?? 'filled') === s}
              onClick={() => updateTheme({ buttonStyle: s })}
            >
              {s[0]?.toUpperCase() + s.slice(1)}
            </SegButton>
          ))}
        </SegGroup>
      </Box>

      <Box marginBottom={4}>
        <SectionTitle>Width</SectionTitle>
        <SegGroup $cols={2}>
          {(['auto', 'full'] as ButtonWidth[]).map((w) => (
            <SegButton
              key={w}
              type="button"
              $selected={(currentTheme.buttonWidth ?? 'auto') === w}
              onClick={() => updateTheme({ buttonWidth: w })}
            >
              {w === 'auto' ? 'Auto' : 'Full width'}
            </SegButton>
          ))}
        </SegGroup>
      </Box>

      <Box marginBottom={4}>
        <SectionTitle>Alignment</SectionTitle>
        <SegGroup $cols={3}>
          {(['left', 'center', 'right'] as ButtonAlign[]).map((a) => (
            <SegButton
              key={a}
              type="button"
              $selected={(currentTheme.buttonAlign ?? 'left') === a}
              onClick={() => updateTheme({ buttonAlign: a })}
            >
              {a[0]?.toUpperCase() + a.slice(1)}
            </SegButton>
          ))}
        </SegGroup>
      </Box>

      <Box marginBottom={4}>
        <SectionTitle>Background color</SectionTitle>
        <ColorPicker
          value={currentTheme.buttonBg ?? '#1f77ff'}
          placeholder="Inherit (primary)"
          onChange={(hex) => updateTheme({ buttonBg: hex })}
          onReset={() => updateTheme({ buttonBg: undefined })}
          showReset={!!currentTheme.buttonBg}
        />
      </Box>

      <Box marginBottom={4}>
        <SectionTitle>Text color</SectionTitle>
        <ColorPicker
          value={currentTheme.buttonColor ?? '#ffffff'}
          placeholder="Inherit"
          onChange={(hex) => updateTheme({ buttonColor: hex })}
          onReset={() => updateTheme({ buttonColor: undefined })}
          showReset={!!currentTheme.buttonColor}
        />
      </Box>

      <Box marginBottom={4}>
        <SectionTitle>Border color</SectionTitle>
        <ColorPicker
          value={currentTheme.buttonBorderColor ?? '#1f77ff'}
          placeholder="Inherit"
          onChange={(hex) => updateTheme({ buttonBorderColor: hex })}
          onReset={() => updateTheme({ buttonBorderColor: undefined })}
          showReset={!!currentTheme.buttonBorderColor}
        />
      </Box>

      <Box marginBottom={4}>
        <SectionTitle>Border thickness</SectionTitle>
        <SegGroup $cols={4}>
          {(['none', 'thin', 'regular', 'thick'] as FieldBorderWidth[]).map((b) => (
            <SegButton
              key={b}
              type="button"
              $selected={(currentTheme.buttonBorderWidth ?? 'thin') === b}
              onClick={() => updateTheme({ buttonBorderWidth: b })}
            >
              {b[0]?.toUpperCase() + b.slice(1)}
            </SegButton>
          ))}
        </SegGroup>
      </Box>

      <Box marginBottom={4}>
        <SectionTitle>Padding</SectionTitle>
        <SegGroup $cols={3}>
          {(['compact', 'normal', 'large'] as FieldPadding[]).map((p) => (
            <SegButton
              key={p}
              type="button"
              $selected={(currentTheme.buttonPadding ?? 'normal') === p}
              onClick={() => updateTheme({ buttonPadding: p })}
            >
              {p[0]?.toUpperCase() + p.slice(1)}
            </SegButton>
          ))}
        </SegGroup>
      </Box>

      <Box marginBottom={4}>
        <SectionTitle>Text size</SectionTitle>
        <SegGroup $cols={3}>
          {(['sm', 'md', 'lg'] as FieldSize[]).map((s) => (
            <SegButton
              key={s}
              type="button"
              $selected={(currentTheme.buttonSize ?? 'md') === s}
              onClick={() => updateTheme({ buttonSize: s })}
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
              Bold button text
            </Typography>
          </Box>
          <Toggle
            aria-label="Bold button text"
            checked={!!currentTheme.buttonBold}
            onChange={() =>
              updateTheme({ buttonBold: currentTheme.buttonBold ? undefined : true })
            }
          />
        </ToggleRow>
      </Box>

      <SectionDivider />

      {/* ---------- Reset button ---------- */}
      <Box marginBottom={4}>
        <ToggleRow>
          <Box flex="1">
            <Typography variant="omega" fontWeight="bold" tag="div">
              Show reset button
            </Typography>
            <Typography variant="pi" textColor="neutral600" tag="div">
              Adds a Reset link next to Submit on the public form.
            </Typography>
          </Box>
          <Toggle
            aria-label="Show reset button"
            checked={showReset}
            onChange={() => onSettingsChange({ showReset: !showReset })}
          />
        </ToggleRow>
      </Box>

      {showReset && (
        <Box marginBottom={4}>
          <SectionTitle>Reset button label</SectionTitle>
          <Field.Root name="resetButtonLabel">
            <Field.Input
              value={settings?.resetButtonLabel ?? 'Reset'}
              placeholder="Reset"
              onChange={(e: any) =>
                onSettingsChange({ resetButtonLabel: e.target.value })
              }
            />
          </Field.Root>
        </Box>
      )}
    </Box>
  );
};

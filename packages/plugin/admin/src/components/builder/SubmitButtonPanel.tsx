/**
 * Per-element style controls for the submit button, shown when the user clicks
 * the Send button in the Style-mode preview. Backed by the global theme since
 * the submit button is form-wide.
 */
import styled from 'styled-components';
import { Box, Typography, Field } from '@strapi/design-system';
import type { ThemeConfig, ButtonStyle, ButtonWidth, ButtonAlign } from './themes';

type Props = {
  theme: ThemeConfig | undefined;
  onChange: (theme: ThemeConfig) => void;
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

export const SubmitButtonPanel = ({ theme, onChange }: Props) => {
  const current: ThemeConfig = theme ?? { preset: 'default' };
  const update = (patch: Partial<ThemeConfig>) => onChange({ ...current, ...patch });

  return (
    <Box>
      <Box marginBottom={4}>
        <SectionTitle>Submit button</SectionTitle>
        <SegGroup $cols={3}>
          {(['filled', 'outline', 'ghost'] as ButtonStyle[]).map((s) => (
            <SegButton
              key={s}
              type="button"
              $selected={(current.buttonStyle ?? 'filled') === s}
              onClick={() => update({ buttonStyle: s })}
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
              $selected={(current.buttonWidth ?? 'auto') === w}
              onClick={() => update({ buttonWidth: w })}
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
              $selected={(current.buttonAlign ?? 'left') === a}
              onClick={() => update({ buttonAlign: a })}
            >
              {a[0]?.toUpperCase() + a.slice(1)}
            </SegButton>
          ))}
        </SegGroup>
      </Box>
    </Box>
  );
};

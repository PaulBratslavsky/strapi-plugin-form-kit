/**
 * Color picker control used by StylePanel. Wraps `react-colorful` (MIT, ~3 KB)
 * in a small popover and gives a hex input + click-to-open swatch surface.
 */
import { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { HexColorPicker } from 'react-colorful';

type Props = {
  value: string;
  placeholder?: string;
  onChange: (hex: string) => void;
  onReset?: () => void;
  showReset?: boolean;
};

const isValidHex = (s: string) => /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(s);

const Wrap = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  position: relative;
`;

const Swatch = styled.button`
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme?.colors?.neutral200 ?? '#dcdce4'};
  cursor: pointer;
  flex-shrink: 0;
  padding: 0;
  position: relative;
  overflow: hidden;

  /* Checkerboard for transparent / partial alpha colors */
  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(45deg, #d6d6e0 25%, transparent 25%),
      linear-gradient(-45deg, #d6d6e0 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, #d6d6e0 75%),
      linear-gradient(-45deg, transparent 75%, #d6d6e0 75%);
    background-size: 12px 12px;
    background-position: 0 0, 0 6px, 6px -6px, -6px 0;
    z-index: 0;
  }
`;

const SwatchFill = styled.span<{ $color: string }>`
  position: absolute;
  inset: 0;
  background: ${({ $color }) => $color};
  z-index: 1;
`;

const HexInput = styled.input`
  flex: 1;
  padding: 8px 12px;
  font: inherit;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.875rem;
  border: 1px solid ${({ theme }) => theme?.colors?.neutral200 ?? '#dcdce4'};
  border-radius: 6px;
  background: ${({ theme }) => theme?.colors?.neutral0 ?? '#fff'};
  color: ${({ theme }) => theme?.colors?.neutral800 ?? '#32324d'};
  text-transform: lowercase;
  letter-spacing: 0.04em;
  min-width: 0;

  &:focus {
    outline: 2px solid ${({ theme }) => theme?.colors?.primary600 ?? '#4945ff'};
    outline-offset: -1px;
    border-color: ${({ theme }) => theme?.colors?.primary600 ?? '#4945ff'};
  }
`;

const ResetButton = styled.button`
  border: none;
  background: transparent;
  font-size: 0.75rem;
  color: ${({ theme }) => theme?.colors?.neutral600 ?? '#666687'};
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;

  &:hover {
    background: ${({ theme }) => theme?.colors?.neutral150 ?? '#eaeaef'};
    color: ${({ theme }) => theme?.colors?.neutral800 ?? '#32324d'};
  }
`;

const PopoverWrap = styled.div`
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  z-index: 20;
  padding: 12px;
  background: ${({ theme }) => theme?.colors?.neutral0 ?? '#fff'};
  border: 1px solid ${({ theme }) => theme?.colors?.neutral200 ?? '#dcdce4'};
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(33, 33, 52, 0.14);

  & .react-colorful {
    width: 220px;
    height: 200px;
  }

  & .react-colorful__saturation {
    border-radius: 6px;
    margin-bottom: 8px;
  }
  & .react-colorful__hue {
    border-radius: 6px;
  }
`;

export const ColorPicker = ({ value, placeholder, onChange, onReset, showReset }: Props) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', escHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', escHandler);
    };
  }, [open]);

  const commitDraft = () => {
    if (isValidHex(draft)) onChange(draft.toLowerCase());
    else setDraft(value);
  };

  return (
    <Wrap ref={wrapRef}>
      <Swatch
        type="button"
        aria-label="Pick a color"
        onClick={() => setOpen((o) => !o)}
      >
        <SwatchFill $color={value} />
      </Swatch>
      <HexInput
        value={draft}
        placeholder={placeholder ?? '#000000'}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitDraft}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
      {showReset && onReset && (
        <ResetButton type="button" onClick={onReset}>
          Reset
        </ResetButton>
      )}
      {open && (
        <PopoverWrap onClick={(e) => e.stopPropagation()}>
          <HexColorPicker color={value} onChange={(hex) => onChange(hex)} />
        </PopoverWrap>
      )}
    </Wrap>
  );
};

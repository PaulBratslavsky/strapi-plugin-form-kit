/**
 * Wraps the FormPreview in a fake browser/site chrome so the user gets a clearer
 * sense of what their form will look like rendered on a real page. Adds a theme
 * switcher so it's easy to flip between presets without leaving the modal.
 */
import { useState } from 'react';
import styled from 'styled-components';
import { FormPreview } from './FormPreview';
import { PRESET_ORDER, PRESETS, normalizePreset, type ThemePreset } from './themes';
import type { FormDraft } from '../../hooks/useFormSchema';

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const SwitcherBar = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 10px 12px;
  background: ${({ theme }) => theme?.colors?.neutral100 ?? '#f6f6f9'};
  border: 1px solid ${({ theme }) => theme?.colors?.neutral200 ?? '#dcdce4'};
  border-radius: 8px;
`;

const SwitcherLabel = styled.span`
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: ${({ theme }) => theme?.colors?.neutral500 ?? '#8e8ea9'};
  margin-right: 4px;
`;

const SwitcherChip = styled.button<{ $active: boolean; $bg: string; $primary: string }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px 4px 4px;
  border-radius: 999px;
  border: 2px solid
    ${({ $active, theme }) =>
      $active ? theme?.colors?.primary600 ?? '#4945ff' : theme?.colors?.neutral200 ?? '#dcdce4'};
  background: ${({ theme }) => theme?.colors?.neutral0 ?? '#fff'};
  font-size: 0.75rem;
  font-weight: 500;
  color: ${({ theme }) => theme?.colors?.neutral800 ?? '#32324d'};
  cursor: pointer;
  transition: border-color 120ms ease;

  &:hover {
    border-color: ${({ theme }) => theme?.colors?.primary600 ?? '#4945ff'};
  }
`;

const ChipSwatches = styled.span<{ $bg: string; $primary: string; $border: string }>`
  display: inline-block;
  width: 22px;
  height: 18px;
  border-radius: 4px;
  background: linear-gradient(to right, ${({ $bg }) => $bg} 50%, ${({ $primary }) => $primary} 50%);
  border: 1px solid ${({ $border }) => $border};
`;

const Browser = styled.div`
  border: 1px solid ${({ theme }) => theme?.colors?.neutral200 ?? '#dcdce4'};
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(33, 33, 52, 0.08);
  background: ${({ theme }) => theme?.colors?.neutral0 ?? '#fff'};
`;

const BrowserChrome = styled.div`
  background: ${({ theme }) => theme?.colors?.neutral100 ?? '#f6f6f9'};
  border-bottom: 1px solid ${({ theme }) => theme?.colors?.neutral200 ?? '#dcdce4'};
  padding: 10px 14px;
  display: flex;
  align-items: center;
  gap: 10px;
`;

const Dot = styled.span<{ $color: string }>`
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: ${({ $color }) => $color};
`;

const AddressBar = styled.div`
  flex: 1;
  background: ${({ theme }) => theme?.colors?.neutral0 ?? '#fff'};
  border: 1px solid ${({ theme }) => theme?.colors?.neutral200 ?? '#dcdce4'};
  border-radius: 999px;
  padding: 4px 12px;
  font-size: 0.75rem;
  color: ${({ theme }) => theme?.colors?.neutral600 ?? '#666687'};
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
`;

const PageBg = styled.div<{ $bg: string }>`
  padding: 32px 24px 48px;
  background: ${({ $bg }) => $bg};
  display: flex;
  justify-content: center;
  min-height: 320px;
`;

type Props = {
  schema: FormDraft;
  publicSubmitUrl?: string;
  publishedAt: string | null;
  baseUrl?: string;
};

export const PreviewFrame = ({ schema, publicSubmitUrl, publishedAt, baseUrl }: Props) => {
  const savedPreset = normalizePreset(schema.settings?.theme?.preset);
  const activeVars = PRESETS[savedPreset].vars;

  return (
    <Wrap>
      <Browser>
        <BrowserChrome>
          <Dot $color="#ff5f56" />
          <Dot $color="#ffbd2e" />
          <Dot $color="#27c93f" />
          <AddressBar>{baseUrl ?? 'https://your-site.example.com/contact'}</AddressBar>
        </BrowserChrome>
        <PageBg $bg={activeVars['--sf-bg']}>
          <FormPreview
            schema={schema}
            publicSubmitUrl={publicSubmitUrl}
            publishedAt={publishedAt}
          />
        </PageBg>
      </Browser>
    </Wrap>
  );
};

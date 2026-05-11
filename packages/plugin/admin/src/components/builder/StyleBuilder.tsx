/**
 * The "Style" half of the builder. Two columns by default: global style controls
 * on the left, large live themed preview on the right. Clicking a field in the
 * preview opens a third column (per-field style overrides) — same pattern as
 * Build mode's "select field → config drawer".
 */
import { useState } from 'react';
import styled from 'styled-components';
import { Typography, IconButton, Button } from '@strapi/design-system';
import { Cross, Sparkle } from '@strapi/icons';
import type { Field, FormDraft } from '../../hooks/useFormSchema';
import { StylePanel } from './StylePanel';
import { PreviewFrame } from './PreviewFrame';
import { FieldStyleSection } from './FieldStyleSection';
import { FormFooterPanel } from './FormFooterPanel';
import type { ThemeConfig } from './themes';
import type { Settings } from '../../hooks/useFormSchema';
import { pickRandomVibe, VIBES } from './vibes';

type Props = {
  schema: FormDraft;
  publicSubmitUrl?: string;
  publishedAt: string | null;
  baseUrl?: string;
  onThemeChange: (theme: ThemeConfig) => void;
  onFieldChange: (id: string, patch: Partial<Field>) => void;
  onSettingsChange: (patch: Partial<Settings>) => void;
};

const Layout = styled.div<{ $hasFieldDrawer: boolean }>`
  display: grid;
  grid-template-columns: ${({ $hasFieldDrawer }) =>
    $hasFieldDrawer ? '340px 1fr 340px' : '380px 1fr'};
  gap: 24px;
  padding: 24px 32px;
  align-items: start;
  transition: grid-template-columns 200ms ease;
`;

const ControlsCard = styled.div`
  background: ${({ theme }) => theme?.colors?.neutral0 ?? '#fff'};
  border: 1px solid ${({ theme }) => theme?.colors?.neutral200 ?? '#dcdce4'};
  border-radius: 12px;
  position: sticky;
  top: 24px;
  max-height: calc(100vh - 130px);
  overflow-y: auto;
`;

const ControlsHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid ${({ theme }) => theme?.colors?.neutral200 ?? '#dcdce4'};
`;

const LuckyBadge = styled.span`
  display: inline-block;
  margin-top: 6px;
  padding: 2px 8px;
  font-size: 0.7rem;
  font-weight: 600;
  color: ${({ theme }) => theme?.colors?.primary700 ?? '#271fe0'};
  background: ${({ theme }) => theme?.colors?.primary100 ?? '#f0f0ff'};
  border-radius: 999px;
  animation: sfLuckyPop 1.6s ease-out;

  @keyframes sfLuckyPop {
    0%   { transform: scale(0.6); opacity: 0; }
    20%  { transform: scale(1.05); opacity: 1; }
    100% { transform: scale(1); opacity: 1; }
  }
`;

const PreviewWrap = styled.div<{ $selectedId: string | null }>`
  min-width: 0;
  position: relative;

  /* Disable form interaction in the preview — clicks select the field instead.
     But keep elements that ARE the selection target (submit button, etc.) clickable. */
  form input,
  form textarea,
  form select,
  form button:not([data-sf-field-id]) {
    pointer-events: none;
  }

  /* Force pointer-events on any element that's a selectable target, even if it
     would otherwise inherit the disabled state. */
  [data-sf-field-id] {
    pointer-events: auto !important;
  }

  /* Wrap each field in a clickable section that spans the full form width. */
  [data-sf-field-id] {
    cursor: pointer;
    position: relative;
    transition: box-shadow 120ms ease, background 120ms ease;
    border-radius: 6px;
    /* Negative margin + padding so the hover/select highlight extends to the edges
       of the form column without changing the layout. */
    margin-left: -12px;
    margin-right: -12px;
    padding: 8px 12px;
  }

  [data-sf-field-id]:hover {
    box-shadow: 0 0 0 2px ${({ theme }) => theme?.colors?.primary500 ?? '#7b79ff'};
    background: rgba(73, 69, 255, 0.04);
  }

  [data-sf-field-id]:hover::before {
    content: attr(data-sf-field-id-label);
    position: absolute;
    top: -22px;
    left: 0;
    padding: 2px 10px;
    background: ${({ theme }) => theme?.colors?.primary500 ?? '#7b79ff'};
    color: #fff;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    border-radius: 4px 4px 0 0;
    z-index: 2;
    white-space: nowrap;
    pointer-events: none;
  }

  ${({ $selectedId, theme }) =>
    $selectedId
      ? `
        [data-sf-field-id="${$selectedId}"] {
          box-shadow: 0 0 0 2px ${theme?.colors?.primary600 ?? '#4945ff'};
          background: rgba(73, 69, 255, 0.06);
        }
        [data-sf-field-id="${$selectedId}"]::before {
          content: attr(data-sf-field-id-label);
          position: absolute;
          top: -22px;
          left: 0;
          padding: 2px 10px;
          background: ${theme?.colors?.primary600 ?? '#4945ff'};
          color: #fff;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          border-radius: 4px 4px 0 0;
          z-index: 2;
          white-space: nowrap;
          pointer-events: none;
        }
      `
      : ''}
`;

export const StyleBuilder = ({
  schema,
  publicSubmitUrl,
  publishedAt,
  baseUrl,
  onThemeChange,
  onFieldChange,
  onSettingsChange,
}: Props) => {
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [luckyVibe, setLuckyVibe] = useState<{ name: string; id: string } | null>(null);

  const rollLucky = (shiftKey: boolean) => {
    // Shift-click steps through the vibes in order — lets you compare them.
    let next;
    if (shiftKey && luckyVibe) {
      const idx = VIBES.findIndex((v) => v.id === luckyVibe.id);
      next = VIBES[(idx + 1) % VIBES.length];
    } else {
      next = pickRandomVibe(luckyVibe?.id);
    }
    onThemeChange(next.theme);
    setLuckyVibe({ name: next.name, id: next.id });
  };
  const selectedField = schema.fields.find((f) => f.id === selectedFieldId) ?? null;
  const isFooterSelected = selectedFieldId === '__footer__';
  const drawerOpen = !!selectedField || isFooterSelected;

  return (
    <Layout $hasFieldDrawer={drawerOpen}>
      <ControlsCard>
        <ControlsHeader>
          <div>
            <Typography variant="beta" tag="div">
              Style
            </Typography>
            <Typography variant="pi" textColor="neutral600" tag="div">
              Visual customizations apply to the public form.
            </Typography>
            {luckyVibe && (
              <LuckyBadge key={luckyVibe.id}>
                ✨ {luckyVibe.name}
              </LuckyBadge>
            )}
          </div>
          <Button
            variant="tertiary"
            size="S"
            startIcon={<Sparkle />}
            onClick={(e: any) => rollLucky(e.shiftKey)}
            title="Shift-click to step through the vibes in order"
          >
            I'm feeling lucky
          </Button>
        </ControlsHeader>
        <StylePanel theme={schema.settings?.theme} onChange={onThemeChange} />
      </ControlsCard>

      <PreviewWrap
        $selectedId={selectedFieldId}
        onClick={(e) => {
          // Find the closest field wrapper and select it. Block native form actions
          // (submit, dropdown open) so clicking selects instead of interacting.
          const target = e.target as HTMLElement;
          const fieldEl = target.closest('[data-sf-field-id]') as HTMLElement | null;
          if (fieldEl) {
            e.preventDefault();
            const id = fieldEl.getAttribute('data-sf-field-id');
            if (id) setSelectedFieldId(id);
          } else {
            setSelectedFieldId(null);
          }
        }}
      >
        <PreviewFrame
          schema={schema}
          publicSubmitUrl={publicSubmitUrl}
          publishedAt={publishedAt}
          baseUrl={baseUrl}
        />
      </PreviewWrap>

      {drawerOpen && (
        <ControlsCard>
          <ControlsHeader>
            <div>
              <Typography variant="beta" tag="div">
                {isFooterSelected ? 'Form footer' : selectedField?.label || 'Field'}
              </Typography>
              <Typography variant="pi" textColor="neutral600" tag="div">
                {isFooterSelected
                  ? 'submit & reset buttons'
                  : `${selectedField?.type} · style overrides`}
              </Typography>
            </div>
            <IconButton
              label="Close"
              withTooltip
              onClick={() => setSelectedFieldId(null)}
            >
              <Cross />
            </IconButton>
          </ControlsHeader>
          <div style={{ padding: 16 }}>
            {isFooterSelected ? (
              <FormFooterPanel
                theme={schema.settings?.theme}
                settings={schema.settings}
                onThemeChange={onThemeChange}
                onSettingsChange={onSettingsChange}
              />
            ) : selectedField ? (
              <FieldStyleSection
                field={selectedField}
                onChange={(patch) => onFieldChange(selectedField.id, patch)}
              />
            ) : null}
          </div>
        </ControlsCard>
      )}
    </Layout>
  );
};

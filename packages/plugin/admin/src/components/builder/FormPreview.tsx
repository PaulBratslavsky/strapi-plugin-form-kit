/**
 * Admin-side form preview. Renders the form by delegating to the actual
 * embed runtime (`@strapi-forms/embed#renderForm`) with `preloadedSchema`,
 * so the preview is — by construction — identical to what end users see
 * on a real page. No styled-components, no parallel React renderer; just
 * the embed's vanilla DOM with a thin React shell for the "send real
 * submission" toggle, success/error banners, and click delegation for
 * field selection (the Style mode parent listens via `[data-sf-field-id]`).
 *
 * Replaces the prior ~700-line parallel React implementation. The bug
 * class "admin preview doesn't match live embed" is structurally
 * eliminated.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { renderForm } from '@strapi-forms/embed';
import type { FormDraft } from '../../hooks/useFormSchema';
import type { ThemePreset } from './themes';

type Props = {
  schema: FormDraft;
  publicSubmitUrl?: string;
  publishedAt: string | null;
  /** Override the saved preset for live theme-flipping in the Preview & test modal. */
  themePresetOverride?: ThemePreset;
};

const Container = styled.div`
  width: 100%;
`;

const TestBanner = styled.div`
  margin: 0 auto 16px;
  max-width: var(--sf-form-max-width, 560px);
  padding: 12px 14px;
  background: ${({ theme }) => theme?.colors?.neutral100 ?? '#f6f6f9'};
  border: 1px solid ${({ theme }) => theme?.colors?.neutral200 ?? '#dcdce4'};
  border-radius: 8px;
  font-size: 0.8125rem;
  color: ${({ theme }) => theme?.colors?.neutral700 ?? '#4a4a6a'};
`;

const Pill = styled.span<{ $tone: 'ok' | 'warn' }>`
  display: inline-block;
  padding: 2px 8px;
  margin-right: 8px;
  border-radius: 999px;
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: ${({ $tone, theme }) =>
    $tone === 'ok' ? theme?.colors?.success700 ?? '#2f6846' : theme?.colors?.warning700 ?? '#a35e1d'};
  background: ${({ $tone, theme }) =>
    $tone === 'ok' ? theme?.colors?.success100 ?? '#eafbe7' : theme?.colors?.warning100 ?? '#fff5da'};
`;

const Banner = styled.div<{ $tone: 'success' | 'error' }>`
  margin: 0 auto 16px;
  max-width: var(--sf-form-max-width, 560px);
  padding: 12px 14px;
  border-radius: 8px;
  font-size: 0.875rem;
  background: ${({ $tone, theme }) =>
    $tone === 'success' ? theme?.colors?.success100 ?? '#eafbe7' : theme?.colors?.danger100 ?? '#fcecea'};
  color: ${({ $tone, theme }) =>
    $tone === 'success' ? theme?.colors?.success700 ?? '#2f6846' : theme?.colors?.danger700 ?? '#a82215'};
`;

const Mount = styled.div`
  /* The embed runtime renders into this. */
`;

export const FormPreview = ({
  schema,
  publicSubmitUrl,
  publishedAt,
  themePresetOverride,
}: Props) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [sendReal, setSendReal] = useState(false);
  const [result, setResult] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  // Resolve the schema we'll hand to renderForm. Two-way override:
  //   - themePresetOverride (preview-only preset flipping)
  //   - sendReal toggle (preview-only behaviour, not part of schema)
  const previewSchema = useMemo(() => {
    const base = schema as FormDraft;
    if (!themePresetOverride) return base;
    return {
      ...base,
      settings: {
        ...base.settings,
        theme: {
          ...(base.settings?.theme ?? {}),
          preset: themePresetOverride,
        },
      },
    } as FormDraft;
  }, [schema, themePresetOverride]);

  // The embed runtime owns DOM rendering. We re-mount on schema change
  // and clean up on unmount. preloadedSchema bypasses the network — works
  // for unpublished drafts too.
  useEffect(() => {
    const target = mountRef.current;
    if (!target) return;
    let destroyed = false;
    let handle: { destroy: () => void } | null = null;

    setResult(null);

    void renderForm({
      target,
      // `baseUrl` is only used by the submit hook when sendReal is true.
      // We override behaviour via hooks below — the URL otherwise is moot.
      baseUrl:
        publicSubmitUrl ? new URL(publicSubmitUrl).origin : window.location.origin,
      slug: 'preview',
      preloadedSchema: {
        schemaVersion: 1,
        formId: 'preview',
        slug: 'preview',
        schema: previewSchema as any,
        submissionUrl: publicSubmitUrl ?? '',
      },
      hooks: {
        // beforeSubmit returning false cancels the submit. For test-mode
        // (sendReal=false) we cancel and synthesise a fake success;
        // otherwise we let the embed fire its normal POST.
        beforeSubmit: (data) => {
          if (!(sendReal && publicSubmitUrl && publishedAt)) {
            // Show a fake success based on schema's configured message.
            const successMessage =
              (previewSchema.settings as any)?.successMessage ??
              'Thank you for your submission.';
            setResult({ kind: 'success', text: `Preview only — would submit: ${successMessage}` });
            return false;
          }
          return data;
        },
        afterSubmit: ({ submissionId, successMessage }) => {
          setResult({
            kind: 'success',
            text: `${successMessage}${submissionId ? ` (id: ${submissionId})` : ''}`,
          });
        },
        onValidationError: () => {
          // The embed renders inline errors itself — nothing to do here.
        },
      },
    }).then((h) => {
      if (destroyed) {
        h.destroy();
      } else {
        handle = h;
      }
    });

    return () => {
      destroyed = true;
      handle?.destroy();
    };
  }, [previewSchema, sendReal, publicSubmitUrl, publishedAt]);

  return (
    <Container>
      <TestBanner>
        <Pill $tone={publishedAt ? 'ok' : 'warn'}>
          {publishedAt ? 'Published' : 'Draft'}
        </Pill>
        Local preview by default. {publishedAt ? 'Tick below to send a real submission to the inbox.' : 'Publish the form to enable real submissions.'}
        <div style={{ marginTop: 8 }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: publishedAt ? 'pointer' : 'not-allowed', opacity: publishedAt ? 1 : 0.5 }}>
            <input
              type="checkbox"
              checked={sendReal}
              disabled={!publishedAt}
              onChange={(e) => setSendReal(e.target.checked)}
            />
            Send a real submission (fires notifications and webhooks)
          </label>
        </div>
      </TestBanner>

      {result && <Banner $tone={result.kind}>{result.text}</Banner>}

      <Mount ref={mountRef} />
    </Container>
  );
};

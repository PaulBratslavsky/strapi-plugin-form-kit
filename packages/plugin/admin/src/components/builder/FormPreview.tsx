/**
 * Interactive form preview used inside the builder. Renders the current draft as
 * end users will see it (modeled on @strapi-forms/embed CSS hooks), and runs the
 * same client-side validation rules so the user can catch UX problems before
 * publishing — without having to publish, embed, and reload.
 *
 * Optionally posts a real submission against the live endpoint if the form is
 * already published (gated by a confirm checkbox so notifications/webhooks
 * aren't fired by accident).
 */
import { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import type { Field, FormDraft } from '../../hooks/useFormSchema';
import { resolveTheme, PRESETS, PRESET_ORDER, type ThemePreset } from './themes';
import { fieldStyleToVars } from './fieldStyleToVars';

type Props = {
  schema: FormDraft;
  publicSubmitUrl?: string;
  publishedAt: string | null;
  /**
   * Optional override for the theme preset used in the preview only.
   * Lets users flip through themes without committing them to the saved schema.
   */
  themePresetOverride?: ThemePreset;
};

type Errors = Record<string, string[]>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^https?:\/\/.+/i;

const isEmpty = (v: unknown) =>
  v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

const isRequired = (f: Field) =>
  Array.isArray(f.validations) && f.validations.some((r: any) => r.kind === 'required');

const validateLocally = (schema: FormDraft, data: Record<string, unknown>): Errors => {
  const errs: Errors = {};
  for (const field of schema.fields) {
    const v = data[field.id];
    if (isEmpty(v)) {
      if (isRequired(field)) {
        const msg =
          (field.validations ?? []).find((r: any) => r.kind === 'required')?.message ??
          'This field is required.';
        errs[field.id] = [msg];
      }
      continue;
    }
    if (field.type === 'content') continue;
    const typeErr = validateType(field, v);
    if (typeErr) {
      errs[field.id] = [typeErr];
      continue;
    }
    const ruleErrs = applyRules(field, v);
    if (ruleErrs.length > 0) errs[field.id] = ruleErrs;
  }
  return errs;
};

const validateType = (field: Field, value: unknown): string | null => {
  switch (field.type) {
    case 'email':
      return typeof value === 'string' && EMAIL_RE.test(value)
        ? null
        : 'Please enter a valid email address.';
    case 'url':
      return typeof value === 'string' && URL_RE.test(value) ? null : 'Please enter a valid URL.';
    case 'number':
      return Number.isFinite(typeof value === 'number' ? value : Number(value))
        ? null
        : 'Please enter a number.';
    case 'date':
      return typeof value === 'string' && !Number.isNaN(Date.parse(value))
        ? null
        : 'Please enter a valid date.';
    case 'dropdown':
    case 'radio': {
      const opts = (field.options as Array<{ value: string }>) ?? [];
      return typeof value === 'string' && opts.some((o) => o.value === value)
        ? null
        : 'Select a valid option.';
    }
    case 'checkboxes':
      return Array.isArray(value) ? null : 'Select at least one option.';
    default:
      return null;
  }
};

const applyRules = (field: Field, value: unknown): string[] => {
  const out: string[] = [];
  for (const rule of (field.validations as any[]) ?? []) {
    switch (rule.kind) {
      case 'minLength':
        if (typeof value === 'string' && value.length < rule.value)
          out.push(rule.message ?? `Must be at least ${rule.value} characters.`);
        else if (Array.isArray(value) && value.length < rule.value)
          out.push(rule.message ?? `Select at least ${rule.value} option(s).`);
        break;
      case 'maxLength':
        if (typeof value === 'string' && value.length > rule.value)
          out.push(rule.message ?? `Must be at most ${rule.value} characters.`);
        break;
      case 'min': {
        const n = typeof value === 'number' ? value : Number(value);
        if (Number.isFinite(n) && n < rule.value)
          out.push(rule.message ?? `Must be at least ${rule.value}.`);
        break;
      }
      case 'max': {
        const n = typeof value === 'number' ? value : Number(value);
        if (Number.isFinite(n) && n > rule.value)
          out.push(rule.message ?? `Must be at most ${rule.value}.`);
        break;
      }
      case 'pattern':
        if (typeof value === 'string' && !new RegExp(rule.regex).test(value))
          out.push(rule.message ?? 'Does not match the required pattern.');
        break;
      case 'email':
        if (typeof value === 'string' && !EMAIL_RE.test(value))
          out.push(rule.message ?? 'Please enter a valid email address.');
        break;
      case 'url':
        if (typeof value === 'string' && !URL_RE.test(value))
          out.push(rule.message ?? 'Please enter a valid URL.');
        break;
    }
  }
  return out;
};

// ---------- styles (mirror @strapi-forms/embed CSS hook contract) ----------
// All visual properties pull from CSS variables set by the resolved theme on
// the form root, so the in-admin preview matches what the public embed renders.

const SfForm = styled.form`
  font-family: var(--sf-font, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif);
  font-size: var(--sf-font-size, 15px);
  color: var(--sf-text, #1a1a1a);
  background: var(--sf-bg, #ffffff);
  padding: var(--sf-form-padding, 24px);
  border-radius: var(--sf-radius, 4px);
  box-shadow: var(--sf-shadow, none);
  max-width: var(--sf-form-max-width, 560px);
  margin: 16px auto;
  width: 100%;
  box-sizing: border-box;
`;

const SfSubmitRow = styled.div`
  display: flex;
  justify-content: var(--sf-btn-align, flex-start);
`;

const FormBody = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: var(--sf-field-gap, 20px);
  margin-bottom: var(--sf-field-gap, 20px);
`;

const widthBasis = (w?: 'full' | 'half' | 'third' | 'two-thirds') => {
  switch (w) {
    case 'half':
      return 'calc(50% - var(--sf-field-gap, 20px) / 2)';
    case 'third':
      return 'calc(33.333% - var(--sf-field-gap, 20px) * 2 / 3)';
    case 'two-thirds':
      return 'calc(66.666% - var(--sf-field-gap, 20px) / 3)';
    default:
      return '100%';
  }
};

const SfField = styled.div<{
  $invalid: boolean;
  $inline?: boolean;
  $width?: 'full' | 'half' | 'third' | 'two-thirds';
  $hideLabel?: boolean;
}>`
  flex: 0 0 ${({ $width }) => widthBasis($width)};
  min-width: 0;
  display: flex;
  flex-direction: ${({ $inline }) => ($inline ? 'row' : 'column')};
  align-items: ${({ $inline }) => ($inline ? 'flex-start' : 'stretch')};

  & label {
    display: ${({ $hideLabel, $inline }) =>
      $hideLabel ? 'none' : $inline ? 'inline-block' : 'block'};
    font-weight: var(--sf-label-weight, 600);
    font-size: var(--sf-label-size, 0.875rem);
    margin: ${({ $inline }) => ($inline ? '8px 12px 0 0' : '0 0 4px 0')};
    color: var(--sf-text, #1a1a1a);
    flex-shrink: 0;
    min-width: ${({ $inline }) => ($inline ? '120px' : 'auto')};
  }

  & input:not([type='radio']):not([type='checkbox']),
  & textarea,
  & select {
    flex: 1;
    width: 100%;
    box-sizing: border-box;
    padding: var(--sf-input-padding, 8px 12px);
    font: inherit;
    font-weight: var(--sf-input-weight, 400);
    font-size: var(--sf-font-size, 15px);
    color: var(--sf-text, #1a1a1a);
    background: var(--sf-input-bg, #ffffff);
    border: var(--sf-border-width, 1px) solid
      ${({ $invalid }) =>
        $invalid ? 'var(--sf-error, #c0392b)' : 'var(--sf-input-border-color, #c8c8c8)'};
    border-radius: var(--sf-input-radius, var(--sf-radius, 4px));
  }

  & input:not([type='radio']):not([type='checkbox']):focus,
  & textarea:focus,
  & select:focus {
    outline: 2px solid var(--sf-border-focus, #4f8cff);
    outline-offset: 1px;
    border-color: var(--sf-border-focus, #4f8cff);
  }

  /* Radio/checkbox controls are tiny native elements — keep them their natural
     size and let ChoiceItem's flex row line them up with their labels. */
  & input[type='radio'],
  & input[type='checkbox'] {
    flex: none;
    width: auto;
    margin: 0;
    accent-color: var(--sf-primary, #4945ff);
  }
`;

const SfHelp = styled.div`
  margin-top: 4px;
  font-size: 0.875rem;
  color: var(--sf-muted, #666);
`;

const SfError = styled.div`
  margin-top: 4px;
  font-size: 0.875rem;
  color: var(--sf-error, #c0392b);
`;

const RequiredMark = styled.span`
  color: var(--sf-error, #c0392b);
  margin-left: 0.125rem;
`;

const SfSubmit = styled.button`
  display: inline-block;
  padding: var(--sf-btn-padding, 8px 20px);
  font: inherit;
  font-size: var(--sf-btn-font-size, var(--sf-font-size, 15px));
  font-weight: var(--sf-btn-font-weight, 600);
  color: var(--sf-btn-color, var(--sf-primary-contrast, #fff));
  background: var(--sf-btn-bg, var(--sf-primary, #1f77ff));
  border: var(--sf-btn-border-width, var(--sf-border-width, 1px)) solid var(--sf-btn-border, transparent);
  border-radius: var(--sf-radius, 4px);
  cursor: pointer;
  box-shadow: var(--sf-shadow, none);
  width: var(--sf-btn-width, auto);

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const SfSuccess = styled.div`
  padding: 12px 16px;
  background: var(--sf-success-bg, #e6f7ed);
  color: var(--sf-success, #18794e);
  border-radius: var(--sf-radius, 4px);
`;

const SfErrorBanner = styled.div`
  padding: 12px 16px;
  background: var(--sf-error-bg, #fdecea);
  color: var(--sf-error, #b3261e);
  border-radius: var(--sf-radius, 4px);
  margin-bottom: 16px;
`;

const ChoiceList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
  flex: 1;
  min-width: 0;
`;

const ChoiceItem = styled.label`
  display: flex !important;
  align-items: center;
  gap: 8px;
  font-weight: 400 !important;
  margin-bottom: 0 !important;
  cursor: pointer;
  & input {
    width: auto !important;
  }
`;

const TestBar = styled.div`
  margin-bottom: 16px;
  padding: 12px 16px;
  background: #f6f6f9;
  border: 1px solid #dcdce4;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 0.8125rem;
  color: #4a4a6a;

  & label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
  }
`;

const Pill = styled.span<{ $tone: 'success' | 'warn' | 'info' }>`
  display: inline-block;
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  background: ${({ $tone }) =>
    $tone === 'success' ? '#e6f7ed' : $tone === 'warn' ? '#fdf4dc' : '#e9eaff'};
  color: ${({ $tone }) =>
    $tone === 'success' ? '#18794e' : $tone === 'warn' ? '#a78a07' : '#4945ff'};
`;

// ---------- the form ----------

export const FormPreview = ({
  schema,
  publicSubmitUrl,
  publishedAt,
  themePresetOverride,
}: Props) => {
  const initialData = useMemo(() => {
    const d: Record<string, unknown> = {};
    for (const f of schema.fields) {
      if (f.defaultValue !== undefined) d[f.id] = f.defaultValue;
      if (f.type === 'checkboxes') d[f.id] = d[f.id] ?? [];
    }
    return d;
  }, [schema]);

  const [data, setData] = useState<Record<string, unknown>>(initialData);
  const [errors, setErrors] = useState<Errors>({});
  const [submitted, setSubmitted] = useState<{
    successMessage: string;
    submissionId: string | null;
    real: boolean;
  } | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [sendReal, setSendReal] = useState(false);
  const [sending, setSending] = useState(false);

  // Reset when the schema changes (user edits in builder while drawer is open).
  useEffect(() => {
    setData(initialData);
    setErrors({});
    setSubmitted(null);
    setBannerError(null);
  }, [initialData]);

  const setVal = (id: string, v: unknown) => {
    setData((prev) => ({ ...prev, [id]: v }));
    setErrors((prev) => {
      if (!prev[id]) return prev;
      const { [id]: _, ...rest } = prev;
      return rest;
    });
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBannerError(null);

    const localErrs = validateLocally(schema, data);
    if (Object.keys(localErrs).length > 0) {
      setErrors(localErrs);
      return;
    }

    if (sendReal && publicSubmitUrl && publishedAt) {
      setSending(true);
      try {
        const res = await fetch(publicSubmitUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data, honeypot: '' }),
        });
        if (res.status === 201) {
          const body = await res.json();
          setSubmitted({
            successMessage:
              body?.successMessage ?? schema.settings?.successMessage ?? 'Submitted.',
            submissionId: body?.submissionId ?? null,
            real: true,
          });
        } else if (res.status === 400) {
          const body = await res.json();
          if (body?.errors) {
            setErrors(body.errors);
            setBannerError('The server rejected the submission. Field errors below.');
          } else {
            setBannerError('The server rejected the submission.');
          }
        } else {
          setBannerError(`Server returned HTTP ${res.status}.`);
        }
      } catch (err: any) {
        setBannerError(`Network error: ${err?.message ?? 'unknown'}`);
      } finally {
        setSending(false);
      }
    } else {
      // Local-only preview.
      setSubmitted({
        successMessage: schema.settings?.successMessage ?? 'Thanks — looks good!',
        submissionId: null,
        real: false,
      });
    }
  };

  const onReset = () => {
    setData(initialData);
    setErrors({});
    setSubmitted(null);
    setBannerError(null);
  };

  const effectiveTheme = themePresetOverride
    ? { ...(schema.settings?.theme ?? { preset: 'default' as const }), preset: themePresetOverride }
    : schema.settings?.theme;
  const themeStyle = resolveTheme(effectiveTheme) as React.CSSProperties;

  if (submitted) {
    return (
      <div style={themeStyle}>
        <div style={{ marginBottom: 12 }}>
          {submitted.real ? (
            <Pill $tone="success">Real submission · saved to inbox</Pill>
          ) : (
            <Pill $tone="info">Local preview · nothing was sent</Pill>
          )}
        </div>
        <SfSuccess>{submitted.successMessage}</SfSuccess>
        {submitted.submissionId && (
          <div style={{ marginTop: 12, fontSize: '0.875rem', color: '#666' }}>
            Submission ID: <code>{submitted.submissionId}</code>
          </div>
        )}
        <div style={{ marginTop: 16 }}>
          <SfSubmit onClick={onReset}>Test again</SfSubmit>
        </div>
      </div>
    );
  }

  return (
    <SfForm onSubmit={onSubmit} noValidate style={themeStyle}>
      <TestBar>
        <div>
          <Pill $tone={publishedAt ? 'success' : 'warn'}>
            {publishedAt ? 'Published' : 'Draft'}
          </Pill>{' '}
          <span>
            {publishedAt
              ? 'Local preview by default. Tick below to send a real submission to the inbox.'
              : 'Form is unpublished — only local preview is available. Publish to send real submissions.'}
          </span>
        </div>
        {publishedAt && (
          <label>
            <input
              type="checkbox"
              checked={sendReal}
              onChange={(e) => setSendReal(e.target.checked)}
            />
            Send a real submission (fires notifications and webhooks)
          </label>
        )}
      </TestBar>

      {bannerError && <SfErrorBanner>{bannerError}</SfErrorBanner>}

      {schema.fields.length === 0 && (
        <div style={{ color: '#666' }}>
          This form has no fields yet. Drag a field type onto the canvas to start.
        </div>
      )}

      <FormBody>
        {schema.fields.map((field) => (
          <RenderField
            key={field.id}
            field={field}
            inline={effectiveTheme?.labelPosition === 'inline'}
            value={data[field.id]}
            onChange={(v) => setVal(field.id, v)}
            errors={errors[field.id]}
          />
        ))}
      </FormBody>

      {schema.fields.length > 0 && (
        <SfSubmitRow
          data-sf-field-id="__footer__"
          data-sf-field-id-label="FORM FOOTER"
        >
          <SfSubmit type="submit" disabled={sending}>
            {sending ? 'Sending…' : schema.settings?.submitButtonLabel ?? 'Submit'}
          </SfSubmit>
          {schema.settings?.showReset && (
            <button
              type="button"
              onClick={onReset}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: '#666',
                fontSize: '0.875rem',
                marginLeft: 8,
              }}
            >
              {schema.settings?.resetButtonLabel ?? 'Reset'}
            </button>
          )}
        </SfSubmitRow>
      )}
    </SfForm>
  );
};

const RenderField = ({
  field,
  inline,
  value,
  onChange,
  errors,
}: {
  field: Field;
  inline?: boolean;
  value: unknown;
  onChange: (v: unknown) => void;
  errors?: string[];
}) => {
  const invalid = !!errors && errors.length > 0;
  const id = `preview-${field.id}`;
  const required = isRequired(field);

  if (field.type === 'content') {
    return (
      <div
        style={{ marginBottom: 16 }}
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: (field.html as string) ?? '' }}
      />
    );
  }

  if (field.type === 'hidden') {
    return null;
  }

  return (
    <SfField
      data-sf-field-id={field.id}
      data-sf-field-id-label={`${field.label || field.type} · ${field.type}`}
      $invalid={invalid}
      $inline={inline || field.style?.labelAlign === 'inline'}
      $width={field.style?.width}
      $hideLabel={field.style?.hideLabel}
      style={fieldStyleToVars(field.style)}
    >
      <label htmlFor={id}>
        {field.label}
        {required && <RequiredMark aria-hidden="true">*</RequiredMark>}
      </label>
      {renderInput(field, id, value, onChange)}
      {field.helpText && <SfHelp>{field.helpText as string}</SfHelp>}
      {errors?.map((e, i) => <SfError key={i}>{e}</SfError>)}
    </SfField>
  );
};

const renderInput = (
  field: Field,
  id: string,
  value: unknown,
  onChange: (v: unknown) => void
) => {
  const placeholder = (field.placeholder as string) ?? '';
  switch (field.type) {
    case 'text':
    case 'phone':
      return (
        <input
          id={id}
          type={field.type === 'phone' ? 'tel' : 'text'}
          placeholder={placeholder}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'email':
      return (
        <input
          id={id}
          type="email"
          placeholder={placeholder}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'url':
      return (
        <input
          id={id}
          type="url"
          placeholder={placeholder}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'number':
      return (
        <input
          id={id}
          type="number"
          placeholder={placeholder}
          step={(field.step as number) ?? undefined}
          value={value === undefined || value === null ? '' : String(value)}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        />
      );
    case 'date':
      return (
        <input
          id={id}
          type="date"
          min={field.min as string}
          max={field.max as string}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'textarea':
      return (
        <textarea
          id={id}
          rows={(field.rows as number) ?? 4}
          placeholder={placeholder}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'dropdown': {
      const opts = (field.options as Array<{ label: string; value: string }>) ?? [];
      return (
        <select id={id} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)}>
          <option value="" disabled>
            {placeholder || 'Select…'}
          </option>
          {opts.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    }
    case 'radio': {
      const opts = (field.options as Array<{ label: string; value: string }>) ?? [];
      return (
        <ChoiceList>
          {opts.map((o) => (
            <ChoiceItem key={o.value}>
              <input
                type="radio"
                name={field.id}
                value={o.value}
                checked={value === o.value}
                onChange={() => onChange(o.value)}
              />
              {o.label}
            </ChoiceItem>
          ))}
        </ChoiceList>
      );
    }
    case 'checkboxes': {
      const opts = (field.options as Array<{ label: string; value: string }>) ?? [];
      const arr = Array.isArray(value) ? (value as string[]) : [];
      return (
        <ChoiceList>
          {opts.map((o) => (
            <ChoiceItem key={o.value}>
              <input
                type="checkbox"
                value={o.value}
                checked={arr.includes(o.value)}
                onChange={(e) => {
                  if (e.target.checked) onChange([...arr, o.value]);
                  else onChange(arr.filter((v) => v !== o.value));
                }}
              />
              {o.label}
            </ChoiceItem>
          ))}
        </ChoiceList>
      );
    }
    default:
      return (
        <input
          id={id}
          type="text"
          placeholder={`(no preview for "${field.type}")`}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
};

import type {
  FetchedSchema,
  Field,
  FieldRenderer,
  RenderFormHandle,
  RenderFormHooks,
  RenderFormOptions,
  ValidationErrors,
} from './types';
import { coreRenderers } from './field-renderers';
import { validateValues } from './validate';
import { el, clear } from './dom';
import { applyThemeToElement } from './theme';
import { fieldStyleToVars } from './field-style';
// Inline the stylesheet so the IIFE bundle is one self-contained file.
// Vite turns ?inline into a string literal at build time; on first render we
// inject it as a single <style> tag at the document head.
import cssText from './styles.css?inline';

const STYLE_TAG_ID = 'sf-embed-styles';
const ensureStylesInjected = () => {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_TAG_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_TAG_ID;
  style.textContent = cssText;
  // Insert at the *start* of <head> so host-page styles can still override.
  document.head.insertBefore(style, document.head.firstChild);
};

/**
 * The single function that turns a target element + a fetched form schema into a working,
 * validating, submitting form. Honors `hooks` for app-side interception and `fieldRenderers`
 * for custom field types.
 */
export const renderInto = (
  target: HTMLElement,
  fetched: FetchedSchema,
  baseUrl: string,
  options: { hooks?: RenderFormHooks; fieldRenderers?: Record<string, FieldRenderer> } = {}
): RenderFormHandle => {
  const schema = fetched.schema;
  const hooks = options.hooks ?? {};
  const customRenderers = options.fieldRenderers ?? {};
  const resolveRenderer = (type: string): FieldRenderer | undefined =>
    customRenderers[type] ?? coreRenderers[type];

  ensureStylesInjected();

  // Local state.
  const data: Record<string, unknown> = {};
  // Apply field defaults so hidden fields and pre-filled defaults are sent on submit.
  for (const f of schema.fields) {
    if (f.defaultValue !== undefined) data[f.id] = f.defaultValue;
  }

  const fieldEls = new Map<string, HTMLElement>();
  const errorEls = new Map<string, HTMLElement>();

  // Mount.
  clear(target);
  const formEl = el('form', { class: 'sf-form', noValidate: true });
  // Apply theme CSS variables before any field renders so initial paint is correct.
  applyThemeToElement(formEl, schema.settings.theme);
  const errorBanner = el('div', { class: 'sf-error-banner', role: 'alert' });
  errorBanner.style.display = 'none';
  formEl.appendChild(errorBanner);

  const formBody = el('div', { class: 'sf-form-body' });
  formEl.appendChild(formBody);

  for (const field of schema.fields) {
    const fieldId = `sf-${fetched.formId}-${field.id}`;
    const widthClass = field.style?.width ? ` sf-field--w-${field.style.width}` : '';
    const noLabelClass = field.style?.hideLabel ? ' sf-field--no-label' : '';
    const fieldWrapper = el('div', {
      class: `sf-field sf-field--${field.type}${widthClass}${noLabelClass}`,
      // Both attributes are public DOM contract: `data-field-id` is the
      // historical embed convention; `data-sf-field-id` is the admin's
      // selection-target attribute used in Style mode. Emitting both keeps
      // host-page CSS overrides AND the in-admin preview's click-to-select
      // pattern working through the same DOM. `data-sf-field-id-label`
      // is the human-readable label the admin's selection chip reads via
      // `content: attr(data-sf-field-id-label)`. Harmless on a real page.
      'data-field-id': field.id,
      'data-sf-field-id': field.id,
      'data-sf-field-id-label': `${field.label ?? field.type} · ${field.type}`,
    });
    const fieldVars = fieldStyleToVars(field.style);
    for (const [k, v] of Object.entries(fieldVars)) {
      fieldWrapper.style.setProperty(k, v);
    }

    if (field.type !== 'content' && field.type !== 'hidden') {
      const labelText = [field.label];
      if (field.validations?.some((r) => r.kind === 'required')) {
        labelText.push(' ');
      }
      const labelEl = el('label', { class: 'sf-label', for: fieldId }, [field.label]);
      if (field.validations?.some((r) => r.kind === 'required')) {
        labelEl.appendChild(el('span', { class: 'sf-required-mark', 'aria-hidden': 'true' }, ['*']));
      }
      fieldWrapper.appendChild(labelEl);
    }

    const renderer = resolveRenderer(field.type);
    if (!renderer) {
      // Unknown custom type without a host-supplied renderer: fall back to a hidden input
      // so the data still round-trips. The dev sees a console hint.
      console.warn(`[strapi-forms] no renderer for field type "${field.type}"; skipping render.`);
    } else {
      renderer({
        field,
        fieldEl: fieldWrapper,
        inputId: fieldId,
        setValue: (value) => {
          data[field.id] = value;
          // Clear error UI as the user edits.
          const errEl = errorEls.get(field.id);
          if (errEl && errEl.textContent) {
            errEl.textContent = '';
            fieldWrapper.classList.remove('sf-field--invalid');
          }
        },
        initialValue: data[field.id],
      });
    }

    if (field.helpText) {
      fieldWrapper.appendChild(el('div', { class: 'sf-help' }, [field.helpText]));
    }
    const errorSlot = el('div', { class: 'sf-error', role: 'alert' });
    fieldWrapper.appendChild(errorSlot);
    errorEls.set(field.id, errorSlot);
    fieldEls.set(field.id, fieldWrapper);
    formBody.appendChild(fieldWrapper);
  }

  // Honeypot input.
  let honeypotInput: HTMLInputElement | null = null;
  if (schema.settings.honeypotEnabled !== false) {
    honeypotInput = el('input', {
      type: 'text',
      name: '_sf_company_name',
      tabindex: -1,
      autocomplete: 'off',
      class: 'sf-honeypot',
      'aria-hidden': 'true',
    });
    formEl.appendChild(honeypotInput);
  }

  const submitBtn = el(
    'button',
    { type: 'submit', class: 'sf-submit' },
    [schema.settings.submitButtonLabel ?? 'Submit']
  );
  // The submit row gets a footer marker so Style-mode preview can target
  // the whole footer area for the "click here to edit submit button" UX.
  const submitRow = el('div', {
    class: 'sf-submit-row',
    'data-sf-field-id': '__footer__',
    'data-sf-field-id-label': 'Submit button · footer',
  });
  submitRow.appendChild(submitBtn);
  formEl.appendChild(submitRow);

  target.appendChild(formEl);

  // Submit handler.
  const showFieldErrors = (errors: ValidationErrors) => {
    for (const [fieldId, msgs] of Object.entries(errors)) {
      const wrapper = fieldEls.get(fieldId);
      const errEl = errorEls.get(fieldId);
      if (wrapper) wrapper.classList.add('sf-field--invalid');
      if (errEl) errEl.textContent = msgs.join(' ');
    }
    hooks.onValidationError?.(errors);
  };

  const clearErrors = () => {
    errorBanner.style.display = 'none';
    errorBanner.textContent = '';
    for (const wrapper of fieldEls.values()) wrapper.classList.remove('sf-field--invalid');
    for (const errEl of errorEls.values()) errEl.textContent = '';
  };

  const onSubmit = async (event: SubmitEvent) => {
    event.preventDefault();
    clearErrors();
    submitBtn.disabled = true;

    const localErrors = validateValues(schema, data);
    if (Object.keys(localErrors).length > 0) {
      showFieldErrors(localErrors);
      submitBtn.disabled = false;
      return;
    }

    const payload = hooks.beforeSubmit ? await hooks.beforeSubmit({ ...data }) : { ...data };

    try {
      const url = new URL(fetched.submissionUrl, baseUrl).toString();
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: payload, honeypot: honeypotInput?.value ?? '' }),
      });

      if (res.status === 201) {
        const body = (await res.json()) as { submissionId: string | null; successMessage: string };
        const successEl = el('div', { class: 'sf-success', role: 'status' }, [
          body.successMessage ?? 'Thanks!',
        ]);
        clear(target);
        target.appendChild(successEl);
        hooks.afterSubmit?.(body);
        if (schema.settings.redirectUrl) {
          window.location.assign(schema.settings.redirectUrl);
        }
        return;
      }

      if (res.status === 400) {
        const body = (await res.json()) as { errors: ValidationErrors };
        if (body.errors) showFieldErrors(body.errors);
        else errorBanner.textContent = schema.settings.errorMessage ?? 'Submission failed.';
        errorBanner.style.display = '';
      } else {
        errorBanner.textContent = schema.settings.errorMessage ?? 'Submission failed.';
        errorBanner.style.display = '';
      }
    } catch (_e) {
      errorBanner.textContent =
        schema.settings.errorMessage ?? 'Network error. Please try again.';
      errorBanner.style.display = '';
    } finally {
      submitBtn.disabled = false;
    }
  };

  formEl.addEventListener('submit', onSubmit);

  return {
    destroy: () => {
      formEl.removeEventListener('submit', onSubmit);
      clear(target);
    },
  };
};

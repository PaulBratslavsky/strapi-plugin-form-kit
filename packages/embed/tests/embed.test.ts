/// <reference lib="dom" />
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderForm } from '../src';
import type { FetchedSchema } from '../src/types';

const buildFetched = (overrides?: Partial<FetchedSchema['schema']>): FetchedSchema => ({
  schemaVersion: 1,
  formId: 'form-1',
  slug: 'contact',
  submissionUrl: '/api/forms/contact/submit',
  schema: {
    schemaVersion: 1,
    settings: {
      submitButtonLabel: 'Send',
      successMessage: 'Thanks!',
      errorMessage: 'Failed.',
      honeypotEnabled: true,
    },
    fields: [
      {
        id: 'fld-name',
        type: 'text',
        label: 'Name',
        validations: [{ kind: 'required' }],
      },
      {
        id: 'fld-email',
        type: 'email',
        label: 'Email',
        validations: [{ kind: 'required' }],
      },
    ],
    ...overrides,
  },
});

describe('embed renderForm', () => {
  let target: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    target = document.createElement('div');
    document.body.appendChild(target);
  });

  it('renders inputs with correct sf-* classes and labels', async () => {
    await renderForm({
      target,
      baseUrl: 'http://test',
      slug: 'contact',
      preloadedSchema: buildFetched(),
    });

    expect(target.querySelector('form.sf-form')).toBeTruthy();
    expect(target.querySelectorAll('.sf-field').length).toBe(2);
    expect(target.querySelector('.sf-field--text input.sf-input')).toBeTruthy();
    expect(target.querySelector('.sf-field--email input[type=email]')).toBeTruthy();
    expect(target.querySelector('.sf-honeypot')).toBeTruthy();
  });

  it('shows client-side validation errors before posting', async () => {
    const fetchSpy = vi.fn();
    (globalThis as any).fetch = fetchSpy;

    await renderForm({
      target,
      baseUrl: 'http://test',
      slug: 'contact',
      preloadedSchema: buildFetched(),
    });

    const form = target.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    await Promise.resolve();

    expect(fetchSpy).not.toHaveBeenCalled();
    const errors = target.querySelectorAll('.sf-field--invalid');
    expect(errors.length).toBe(2);
  });

  it('posts a successful submission and renders success message', async () => {
    (globalThis as any).fetch = vi.fn().mockResolvedValue({
      status: 201,
      ok: true,
      json: async () => ({ submissionId: 'abc', successMessage: 'Yay!' }),
    });

    await renderForm({
      target,
      baseUrl: 'http://test',
      slug: 'contact',
      preloadedSchema: buildFetched(),
    });

    (target.querySelector('input[name=fld-name]') as HTMLInputElement).value = 'Alice';
    (target.querySelector('input[name=fld-name]') as HTMLInputElement).dispatchEvent(new Event('input'));

    (target.querySelector('input[name=fld-email]') as HTMLInputElement).value = 'a@b.co';
    (target.querySelector('input[name=fld-email]') as HTMLInputElement).dispatchEvent(new Event('input'));

    (target.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit', { cancelable: true, bubbles: true })
    );
    // Allow the async submit handler to resolve.
    await new Promise((r) => setTimeout(r, 5));
    expect(target.querySelector('.sf-success')?.textContent).toBe('Yay!');
  });

  it('shows server-returned 400 errors per field', async () => {
    (globalThis as any).fetch = vi.fn().mockResolvedValue({
      status: 400,
      ok: false,
      json: async () => ({ errors: { 'fld-email': ['Bad email format'] } }),
    });

    await renderForm({
      target,
      baseUrl: 'http://test',
      slug: 'contact',
      preloadedSchema: buildFetched(),
    });

    (target.querySelector('input[name=fld-name]') as HTMLInputElement).value = 'A';
    (target.querySelector('input[name=fld-name]') as HTMLInputElement).dispatchEvent(new Event('input'));
    (target.querySelector('input[name=fld-email]') as HTMLInputElement).value = 'a@b.co';
    (target.querySelector('input[name=fld-email]') as HTMLInputElement).dispatchEvent(new Event('input'));

    (target.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit', { cancelable: true, bubbles: true })
    );
    await new Promise((r) => setTimeout(r, 5));

    const emailErr = target.querySelector('.sf-field[data-field-id=fld-email] .sf-error');
    expect(emailErr?.textContent).toBe('Bad email format');
  });
});

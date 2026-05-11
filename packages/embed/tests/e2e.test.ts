/// <reference lib="dom" />
/**
 * Live end-to-end test against a running Strapi at http://127.0.0.1:1337.
 * Run only when `RUN_E2E=1` is set in the environment.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderForm } from '../src';

const baseUrl = process.env.STRAPI_URL ?? 'http://127.0.0.1:1337';
const skip = process.env.RUN_E2E !== '1';

(skip ? describe.skip : describe)('embed E2E (requires running Strapi)', () => {
  let target: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    target = document.createElement('div');
    document.body.appendChild(target);
  });

  it('renders the seeded contact form and submits successfully', async () => {
    await renderForm({ target, baseUrl, slug: 'contact' });

    expect(target.querySelector('.sf-field--text')).toBeTruthy();
    expect(target.querySelector('.sf-field--email')).toBeTruthy();
    expect(target.querySelector('.sf-field--textarea')).toBeTruthy();

    // Fill in valid values keyed by the seeded UUIDs.
    const setVal = (sel: string, v: string) => {
      const el = target.querySelector(sel) as HTMLInputElement | HTMLTextAreaElement | null;
      if (!el) throw new Error(`element not found: ${sel}`);
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    setVal('input[name="11111111-1111-4111-8111-111111111111"]', 'E2E user');
    setVal('input[name="22222222-2222-4222-8222-222222222222"]', 'e2e@example.com');
    setVal('textarea[name="33333333-3333-4333-8333-333333333333"]', 'Hello from the embed e2e test.');

    const form = target.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    await new Promise((r) => setTimeout(r, 600));

    expect(target.querySelector('.sf-success')?.textContent).toMatch(/Thanks/i);
  }, 15000);
});

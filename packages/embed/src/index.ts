import { renderInto } from './render';
import type { FetchedSchema, RenderFormHandle, RenderFormOptions } from './types';

export type {
  FormSchema,
  Field,
  ValidationRule,
  ChoiceOption,
  FormSettings,
  RenderFormOptions,
  RenderFormHandle,
  RenderFormHooks,
  FieldRenderer,
  FetchedSchema,
  AnalyticsEventType,
} from './types';

const fetchSchema = async (baseUrl: string, slug: string): Promise<FetchedSchema> => {
  const url = new URL(`/api/forms/${encodeURIComponent(slug)}/schema`, baseUrl).toString();
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`[strapi-forms] failed to fetch schema for "${slug}" (${res.status})`);
  }
  return (await res.json()) as FetchedSchema;
};

/**
 * Programmatic API: render a form into the target element.
 * Returns a handle whose `destroy()` clears the target and removes listeners.
 */
export const renderForm = async (options: RenderFormOptions): Promise<RenderFormHandle> => {
  const fetched = options.preloadedSchema ?? (await fetchSchema(options.baseUrl, options.slug));
  return renderInto(options.target, fetched, options.baseUrl, {
    hooks: options.hooks,
    fieldRenderers: options.fieldRenderers,
    disableAnalytics: options.disableAnalytics,
  });
};

/**
 * Resolve the Strapi origin once at script load. Priority:
 *   1. The host page sets `data-strapi-base-url` on the form container (explicit override).
 *   2. The script tag's own origin (`document.currentScript.src`) — works when the
 *      bundle is served by the plugin itself (`/api/forms/embed.js`), which is the
 *      default deploy story.
 *   3. The page origin (fallback — only useful when the form is on the same domain
 *      as Strapi, e.g. local dev).
 */
const detectScriptOrigin = (): string | null => {
  // `currentScript` only exists during initial parse; capture it at module-eval time.
  const script = (document.currentScript as HTMLScriptElement | null) ?? null;
  if (!script?.src) return null;
  try {
    return new URL(script.src).origin;
  } catch {
    return null;
  }
};

const SCRIPT_ORIGIN = detectScriptOrigin();

/**
 * IIFE auto-init: scan the document for `[data-strapi-form]` elements and render each.
 * Multiple instances on a page are fine.
 */
const autoInit = () => {
  const targets = document.querySelectorAll<HTMLElement>('[data-strapi-form]:not([data-sf-rendered])');
  targets.forEach((target) => {
    const slug = target.getAttribute('data-strapi-form');
    const baseUrl =
      target.getAttribute('data-strapi-base-url') ?? SCRIPT_ORIGIN ?? window.location.origin;
    if (!slug) return;
    target.setAttribute('data-sf-rendered', '1');
    renderForm({ target, baseUrl, slug }).catch((err) => {
      console.error('[strapi-forms] render failed', err);
      target.textContent = 'Form unavailable.';
    });
  });
};

declare global {
  interface Window {
    StrapiForms?: { renderForm: typeof renderForm };
  }
}

if (typeof window !== 'undefined') {
  window.StrapiForms = { renderForm };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit, { once: true });
  } else {
    autoInit();
  }
}

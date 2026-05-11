/**
 * Tiny demo harness for @strapi-forms/embed. Lists every published form in
 * the local Strapi instance and renders the selected one via the embed API.
 * Useful as a sanity check that "form built in admin" → "page render +
 * submission" actually works end-to-end against a real browser.
 *
 * Assumes Strapi is running on the BASE_URL below. The embed package is
 * imported via the workspace symlink (pnpm workspace).
 */
import { renderForm } from '@strapi-forms/embed';

const BASE_URL = (import.meta as any).env?.VITE_STRAPI_URL ?? 'http://localhost:1337';

type ListedForm = { slug: string; name: string; documentId: string };
type Handle = { destroy: () => void };

const picker = document.getElementById('form-picker') as HTMLSelectElement;
const target = document.getElementById('target') as HTMLDivElement;
const meta = document.getElementById('meta') as HTMLDivElement;

let active: Handle | null = null;

const setEmpty = (text: string, isError = false) => {
  if (active) {
    active.destroy();
    active = null;
  }
  target.className = 'empty';
  target.textContent = text;
  target.style.color = isError ? '#d02b20' : '#8e8ea9';
};

const setMeta = (form?: ListedForm) => {
  if (!form) {
    meta.textContent = '';
    return;
  }
  meta.innerHTML =
    `<strong>${form.name}</strong> · <code>/api/forms/${form.slug}/submit</code><br>` +
    `Submissions land in: <code>Forms → Submissions inbox</code> in the admin.`;
};

const listPublishedForms = async (): Promise<ListedForm[]> => {
  // Public endpoint: GET /api/forms/:slug/schema returns one form by slug.
  // For listing we hit the admin endpoint without auth — it'll 401, so we
  // instead probe a list of well-known seed slugs. In a real public site
  // you'd know the slug a priori.
  //
  // Better approach: the plugin exposes no public "list all forms" endpoint
  // (intentional — you don't want public enumeration). The admin endpoint
  // does, but requires auth. So this demo asks the user to manually paste
  // a slug, AND tries to fetch the schema to confirm it's published.
  return [];
};

const tryRender = async (slug: string) => {
  setEmpty(`Loading "${slug}"…`);
  // Confirm the form is published by hitting the public schema endpoint first.
  try {
    const r = await fetch(`${BASE_URL}/api/forms/${slug}/schema`);
    if (!r.ok) {
      setEmpty(
        r.status === 404
          ? `No published form with slug "${slug}". Publish it in the admin first.`
          : `Schema fetch failed: HTTP ${r.status}`,
        true
      );
      return;
    }
  } catch (err) {
    setEmpty(`Couldn't reach Strapi at ${BASE_URL}. Is it running?`, true);
    return;
  }
  target.className = '';
  target.textContent = '';
  active = await renderForm({
    target,
    baseUrl: BASE_URL,
    slug,
    hooks: {
      afterSubmit: ({ submissionId }) => {
        console.log('submitted', submissionId);
      },
      onValidationError: (errors) => {
        console.warn('validation errors', errors);
      },
    },
  });
  setMeta({ slug, name: slug, documentId: '' });
};

// We can't list forms anonymously, so let the user pick from manual entry
// or a seeded list (configurable via VITE_FORM_SLUGS env).
const seedSlugs: string[] = (
  ((import.meta as any).env?.VITE_FORM_SLUGS as string | undefined) ?? ''
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

picker.innerHTML = '';
const placeholder = document.createElement('option');
placeholder.value = '';
placeholder.textContent = '— select a published form slug —';
picker.appendChild(placeholder);

for (const slug of seedSlugs) {
  const opt = document.createElement('option');
  opt.value = slug;
  opt.textContent = slug;
  picker.appendChild(opt);
}

const manual = document.createElement('option');
manual.value = '__manual__';
manual.textContent = 'Enter a slug manually…';
picker.appendChild(manual);

picker.addEventListener('change', () => {
  const value = picker.value;
  if (!value) {
    setEmpty('Pick a form above to render it here.');
    setMeta(undefined);
    return;
  }
  if (value === '__manual__') {
    const entered = prompt('Form slug (e.g. "contact"):');
    if (entered) void tryRender(entered.trim());
    picker.value = '';
    return;
  }
  void tryRender(value);
});

if (seedSlugs.length === 0) {
  setEmpty(
    'Tip: set VITE_FORM_SLUGS=contact,signup in .env.local to seed the picker, or pick "Enter a slug manually…"',
  );
}

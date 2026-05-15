import type { Core } from '@strapi/strapi';

/**
 * Shared "find a published form by slug OR documentId" lookup. Used by the
 * public form controller (schema/submit) and the public embed controller
 * (hosted page). Kept in one place so the slug-or-id resolution rule can't
 * drift between them.
 */

// documentIds in Strapi v5 are 25-char lowercase alphanumeric (cuid2-ish).
// Heuristic: if the path segment looks like a documentId, try that lookup
// first, otherwise treat it as a slug. The alt-form lookup runs only if the
// first one misses.
const looksLikeDocumentId = (s: string): boolean => /^[a-z0-9]{20,30}$/.test(s);

export const findPublishedFormByIdOrSlug = async (
  strapi: Core.Strapi,
  idOrSlug: string
): Promise<any> => {
  const tryFilter = async (filters: Record<string, unknown>) =>
    strapi.documents('plugin::forms.form').findFirst({
      filters: { ...filters, publishedAt: { $notNull: true } } as any,
      status: 'published',
    });

  if (looksLikeDocumentId(idOrSlug)) {
    const byId = await tryFilter({ documentId: idOrSlug });
    if (byId) return byId;
  }
  const bySlug = await tryFilter({ slug: idOrSlug });
  if (bySlug) return bySlug;
  if (!looksLikeDocumentId(idOrSlug)) {
    // Fallback: maybe the slug happens to look like a docId we missed.
    return tryFilter({ documentId: idOrSlug });
  }
  return null;
};

export const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

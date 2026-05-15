import fs from 'fs';
import path from 'path';
import { errors } from '@strapi/utils';
import type { Core } from '@strapi/strapi';
import { findPublishedFormByIdOrSlug, escapeHtml } from './shared/form-lookup';

const { NotFoundError } = errors;

/**
 * Asset-serving endpoints — the embed runtime bundle and the standalone
 * HTML wrapper page. Split out of public-form.ts (which owns the form
 * *contract*: schema + submit) because serving JS/HTML is a different
 * concern from the form data API.
 */

// Cache the embed bundle in module scope (production). Re-read every call
// in dev so changes to the embed package show up without a Strapi restart.
let embedJsCache: string | null = null;
const readEmbedBundle = (): string | null => {
  if (embedJsCache && process.env.NODE_ENV !== 'development') return embedJsCache;
  // Where the bundle lands depends on whether we're running the bundled
  // plugin (Strapi-loaded) or unbundled source. Walk a few candidates.
  const candidates = [
    // Bundled — Strapi loads controller from dist/_chunks/, bundle is in
    // dist/embed/ (copied by the plugin's `pnpm run copy:embed` step).
    path.resolve(__dirname, '..', 'embed', 'embed.js'),
    // Same layout but seen from dist/server/.
    path.resolve(__dirname, '..', '..', 'embed', 'embed.js'),
    // Monorepo dev fallback — sibling embed package's own dist.
    path.resolve(__dirname, '..', '..', '..', '..', 'embed', 'dist', 'embed.iife.js'),
    path.resolve(__dirname, '..', '..', '..', '..', '..', 'embed', 'dist', 'embed.iife.js'),
  ];
  for (const file of candidates) {
    if (fs.existsSync(file)) {
      embedJsCache = fs.readFileSync(file, 'utf8');
      return embedJsCache;
    }
  }
  return null;
};

const controller = ({ strapi }: { strapi: Core.Strapi }) => ({
  /**
   * GET /api/forms/embed.js — serve the embed runtime IIFE bundle.
   *
   * The plugin's own server hosts the JS so users get a stable self-hosted
   * URL (`<your-cms>/api/forms/embed.js`) without publishing to npm or
   * relying on a CDN.
   */
  async serveEmbedJs(ctx: any) {
    const body = readEmbedBundle();
    if (!body) {
      ctx.status = 404;
      ctx.type = 'application/javascript';
      ctx.body = '// embed bundle not found. Run `pnpm run copy:embed` in the plugin.';
      return;
    }
    ctx.type = 'application/javascript';
    ctx.set(
      'Cache-Control',
      process.env.NODE_ENV === 'development' ? 'no-cache' : 'public, max-age=3600'
    );
    ctx.set('Access-Control-Allow-Origin', '*');
    ctx.body = body;
  },

  /**
   * GET /api/forms/:slug/embed — serve a complete HTML page wrapping the
   * form. Used as the src for <iframe> embeds and as the standalone
   * shareable URL.
   */
  async serveEmbedPage(ctx: any) {
    const idOrSlug = ctx.params.slug;
    const form = await findPublishedFormByIdOrSlug(strapi, idOrSlug);
    if (!form) throw new NotFoundError(`Form "${idOrSlug}" not found or not published.`);

    const formName = escapeHtml(form.name ?? form.slug);
    const description = escapeHtml(form.description ?? `Submit the ${formName} form.`);
    // The embed runtime needs the form's canonical lookup key. We use the
    // slug (friendlier) but the embed runtime will accept documentId too.
    const lookupKey = escapeHtml(form.slug ?? form.documentId);
    const origin = `${ctx.request.protocol}://${ctx.request.host}`;
    const shareUrl = `${origin}/api/forms/${lookupKey}/embed`;

    // Mostly static — form content is fetched at runtime by the embed
    // against /schema (which has its own ETag revalidation). Keep this
    // no-cache so meta tags reflect the latest name/description on
    // republish. max(updated, published) — same reason as /schema.
    const lastModified = Math.max(
      new Date(form.updatedAt ?? 0).getTime(),
      new Date(form.publishedAt ?? 0).getTime()
    );
    const etag = `W/"${form.documentId}-page-${lastModified || Date.now()}"`;
    ctx.set('Cache-Control', 'no-cache, must-revalidate');
    ctx.set('ETag', etag);
    if (ctx.request.headers['if-none-match'] === etag) {
      ctx.status = 304;
      return;
    }
    ctx.type = 'text/html';
    ctx.body = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${formName}</title>
    <meta name="description" content="${description}">
    <meta property="og:title" content="${formName}">
    <meta property="og:description" content="${description}">
    <meta property="og:url" content="${shareUrl}">
    <meta property="og:type" content="website">
    <meta name="twitter:card" content="summary">
    <meta name="twitter:title" content="${formName}">
    <meta name="twitter:description" content="${description}">
    <style>
      :root { color-scheme: light; }
      html, body { margin: 0; padding: 0; background: transparent; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
      .sf-wrap { max-width: 720px; margin: 0 auto; padding: 32px 20px; }
      @media (max-width: 540px) { .sf-wrap { padding: 16px 12px; } }
    </style>
  </head>
  <body>
    <div class="sf-wrap">
      <div data-strapi-form="${lookupKey}"></div>
    </div>
    <script src="${origin}/api/forms/embed.js"></script>
  </body>
</html>`;
  },
});

export default controller;

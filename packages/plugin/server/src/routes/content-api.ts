/**
 * Public-facing routes. Plugin content-api routes are mounted under /api/<pluginName>
 * by Strapi v5, so paths here are relative to /api/forms/.
 *
 * Forms can additionally require auth via `settings.authenticatedOnly` in the form's
 * schema; the controller enforces that.
 */
export default {
  type: 'content-api',
  routes: [
    // Static routes first so /embed.js isn't shadowed by /:slug.
    {
      method: 'GET',
      path: '/embed.js',
      handler: 'public-form.serveEmbedJs',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/:slug/schema',
      handler: 'public-form.getSchema',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/:slug/submit',
      handler: 'public-form.submit',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/:slug/embed',
      handler: 'public-form.serveEmbedPage',
      config: { auth: false },
    },
  ],
};

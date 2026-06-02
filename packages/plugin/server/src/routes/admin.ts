/**
 * Admin-only routes — backing the visual builder, settings, submissions inbox, etc.
 * Mounted under /forms-plugin/... by Strapi (admin routes prefix with the plugin name).
 *
 * `policies: ['admin::isAuthenticatedAdmin']` enforces that only logged-in admin users
 * can call these. Per-action permissions are layered on in M9 (permissions task).
 */
const adminPolicy = ['admin::isAuthenticatedAdmin'];

export default {
  type: 'admin',
  routes: [
    // ---- Forms CRUD (M4) ----
    {
      method: 'GET',
      path: '/admin/forms',
      handler: 'admin-forms.list',
      config: { policies: adminPolicy },
    },
    {
      method: 'GET',
      path: '/admin/forms/:documentId',
      handler: 'admin-forms.findOne',
      config: { policies: adminPolicy },
    },
    {
      method: 'POST',
      path: '/admin/forms',
      handler: 'admin-forms.create',
      config: { policies: adminPolicy },
    },
    {
      method: 'PUT',
      path: '/admin/forms/:documentId',
      handler: 'admin-forms.update',
      config: { policies: adminPolicy },
    },
    {
      method: 'POST',
      path: '/admin/forms/:documentId/publish',
      handler: 'admin-forms.publish',
      config: { policies: adminPolicy },
    },
    {
      method: 'POST',
      path: '/admin/forms/:documentId/duplicate',
      handler: 'admin-forms.duplicate',
      config: { policies: adminPolicy },
    },
    {
      method: 'DELETE',
      path: '/admin/forms/:documentId',
      handler: 'admin-forms.delete',
      config: { policies: adminPolicy },
    },
    // ---- Field-type registry (M4) ----
    {
      method: 'GET',
      path: '/admin/field-types',
      handler: 'admin-forms.fieldTypes',
      config: { policies: adminPolicy },
    },
    // ---- Content-type picker for optionsSource dropdowns ----
    {
      method: 'GET',
      path: '/admin/content-types',
      handler: 'admin-forms.contentTypes',
      config: { policies: adminPolicy },
    },
    {
      method: 'POST',
      path: '/admin/resolve-options-source',
      handler: 'admin-forms.resolveOptionsSource',
      config: { policies: adminPolicy },
    },
    // ---- Copy-as-AI-prompt (M9) ----
    {
      method: 'GET',
      path: '/admin/forms/:documentId/copy-as-ai-prompt',
      handler: 'admin-forms.copyAsAiPrompt',
      config: { policies: adminPolicy },
    },
    // ---- Notifications (M6) ----
    {
      method: 'GET',
      path: '/admin/forms/:formDocumentId/notifications',
      handler: 'admin-notifications.list',
      config: { policies: adminPolicy },
    },
    {
      method: 'POST',
      path: '/admin/forms/:formDocumentId/notifications',
      handler: 'admin-notifications.create',
      config: { policies: adminPolicy },
    },
    {
      method: 'PUT',
      path: '/admin/notifications/:id',
      handler: 'admin-notifications.update',
      config: { policies: adminPolicy },
    },
    {
      method: 'DELETE',
      path: '/admin/notifications/:id',
      handler: 'admin-notifications.delete',
      config: { policies: adminPolicy },
    },
    {
      method: 'GET',
      path: '/admin/notifications/:id/deliveries',
      handler: 'admin-notifications.deliveries',
      config: { policies: adminPolicy },
    },
    // ---- Webhooks (M7) ----
    {
      method: 'GET',
      path: '/admin/forms/:formDocumentId/webhooks',
      handler: 'admin-webhooks.list',
      config: { policies: adminPolicy },
    },
    {
      method: 'POST',
      path: '/admin/forms/:formDocumentId/webhooks',
      handler: 'admin-webhooks.create',
      config: { policies: adminPolicy },
    },
    {
      method: 'PUT',
      path: '/admin/webhooks/:id',
      handler: 'admin-webhooks.update',
      config: { policies: adminPolicy },
    },
    {
      method: 'DELETE',
      path: '/admin/webhooks/:id',
      handler: 'admin-webhooks.delete',
      config: { policies: adminPolicy },
    },
    {
      method: 'GET',
      path: '/admin/webhooks/:id/deliveries',
      handler: 'admin-webhooks.deliveries',
      config: { policies: adminPolicy },
    },
    // ---- Submissions inbox (M8) ----
    {
      method: 'GET',
      path: '/admin/forms/:formDocumentId/submissions',
      handler: 'admin-submissions.list',
      config: { policies: adminPolicy },
    },
    {
      method: 'POST',
      path: '/admin/submissions/:documentId/status',
      handler: 'admin-submissions.setStatus',
      config: { policies: adminPolicy },
    },
    {
      method: 'POST',
      path: '/admin/submissions/bulk',
      handler: 'admin-submissions.bulk',
      config: { policies: adminPolicy },
    },
    {
      method: 'DELETE',
      path: '/admin/submissions/:documentId',
      handler: 'admin-submissions.delete',
      config: { policies: adminPolicy },
    },
    {
      method: 'GET',
      path: '/admin/forms/:formDocumentId/submissions/export.csv',
      handler: 'admin-submissions.exportCsv',
      config: { policies: adminPolicy },
    },
    {
      method: 'GET',
      path: '/admin/sidebar-badge',
      handler: 'admin-submissions.sidebarBadge',
      config: { policies: adminPolicy },
    },
    // ---- AI builder (Phase 2: M10/M11) ----
    {
      method: 'POST',
      path: '/admin/ai/generate',
      handler: 'admin-ai.generate',
      config: { policies: adminPolicy },
    },
    {
      method: 'POST',
      path: '/admin/ai/refine',
      handler: 'admin-ai.refine',
      config: { policies: adminPolicy },
    },
    {
      method: 'POST',
      path: '/admin/ai/stream',
      handler: 'admin-ai.stream',
      config: { policies: adminPolicy },
    },
    {
      method: 'GET',
      path: '/admin/ai/health',
      handler: 'admin-ai.health',
      config: { policies: adminPolicy },
    },
    {
      method: 'GET',
      path: '/admin/ai/config',
      handler: 'admin-ai.getConfig',
      config: { policies: adminPolicy },
    },
    {
      method: 'PUT',
      path: '/admin/ai/config',
      handler: 'admin-ai.updateConfig',
      config: { policies: adminPolicy },
    },
    // ---- Analytics (M12) ----
    {
      method: 'GET',
      path: '/admin/forms/:formDocumentId/analytics',
      handler: 'admin-analytics.report',
      config: { policies: adminPolicy },
    },
    {
      method: 'GET',
      path: '/admin/forms/:formDocumentId/analytics/export.csv',
      handler: 'admin-analytics.exportCsv',
      config: { policies: adminPolicy },
    },
  ],
};

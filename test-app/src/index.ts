import type { Core } from '@strapi/strapi';

const SAMPLE_CONTACT_FORM = {
  schemaVersion: 1,
  fields: [
    {
      id: '11111111-1111-4111-8111-111111111111',
      type: 'text',
      label: 'Name',
      validations: [{ kind: 'required' }],
    },
    {
      id: '22222222-2222-4222-8222-222222222222',
      type: 'email',
      label: 'Email',
      validations: [{ kind: 'required' }, { kind: 'email' }],
    },
    {
      id: '33333333-3333-4333-8333-333333333333',
      type: 'textarea',
      label: 'Message',
      rows: 5,
      validations: [{ kind: 'required' }, { kind: 'minLength', value: 10 }],
    },
  ],
  settings: {
    submitButtonLabel: 'Send',
    successMessage: 'Thanks — we got your message!',
    honeypotEnabled: true,
  },
};

export default {
  register() {},

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    // Seed a sample published "contact" form if none exists.
    const existing = await strapi
      .documents('plugin::forms.form')
      .findFirst({ filters: { slug: 'contact' } as any });

    if (!existing) {
      await strapi.documents('plugin::forms.form').create({
        data: {
          name: 'Contact form',
          slug: 'contact',
          description: 'A sample contact form seeded by the test-app.',
          schema: SAMPLE_CONTACT_FORM,
        },
        status: 'published',
      } as any);
      strapi.log.info('[test-app] seeded sample contact form');
    }

    // Open public-find access on the form schema and submit endpoints so curl tests work
    // without an API token. Real installs will leave this off and use auth tokens.
    const publicRole = await strapi
      .query('plugin::users-permissions.role')
      .findOne({ where: { type: 'public' } });
    if (publicRole) {
      // No-op for the plugin's content-api routes since they're declared `auth: false`.
    }
  },
};

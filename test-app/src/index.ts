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
    // Seed four published Events so the collection-backed dropdown picker
    // has something to point at. Idempotent — only inserts if zero events.
    const eventCount = await strapi.documents('api::event.event' as any).count({});
    if (eventCount === 0) {
      const SAMPLE_EVENTS = [
        {
          title: 'Strapi Conf 2026',
          startsAt: '2026-09-18T09:00:00.000Z',
          location: 'Paris, France',
          description: 'Annual Strapi developer conference — talks, workshops, and demos.',
        },
        {
          title: 'Plugin Authors Meetup',
          startsAt: '2026-06-12T18:00:00.000Z',
          location: 'Online (Zoom)',
          description: 'Roundtable for plugin authors: marketplace strategy, monorepo tooling, npm distribution.',
        },
        {
          title: 'AI in CMS Workshop',
          startsAt: '2026-07-23T13:00:00.000Z',
          location: 'San Francisco, CA',
          description: 'Hands-on session: integrating LLMs into content workflows with Strapi.',
        },
        {
          title: 'Headless Day Berlin',
          startsAt: '2026-10-05T10:00:00.000Z',
          location: 'Berlin, Germany',
          description: 'Community day for headless CMS practitioners — case studies and lightning talks.',
        },
      ];
      for (const data of SAMPLE_EVENTS) {
        await strapi.documents('api::event.event' as any).create({
          data,
          status: 'published',
        } as any);
      }
      strapi.log.info('[test-app] seeded 4 sample events');
    }

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

import type { Core } from '@strapi/strapi';

const destroy = async ({ strapi }: { strapi: Core.Strapi }) => {
  const webhookDispatcher = strapi.plugin('forms').service('webhookDispatcher');
  await webhookDispatcher.shutdown?.();

  const analytics = strapi.plugin('forms').service('analytics');
  await analytics.shutdown?.();
};

export default destroy;

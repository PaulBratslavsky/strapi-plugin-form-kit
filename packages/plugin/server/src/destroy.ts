import type { Core } from '@strapi/strapi';

const destroy = async ({ strapi }: { strapi: Core.Strapi }) => {
  const webhookDispatcher = strapi.plugin('forms').service('webhookDispatcher');
  await webhookDispatcher.shutdown?.();
};

export default destroy;

import type { Core } from '@strapi/strapi';
import { registerCoreFieldTypes } from './core-field-types';

const bootstrap = async ({ strapi }: { strapi: Core.Strapi }) => {
  strapi.log.info('[strapi-plugin-forms] bootstrap()');

  // 1. Register the 12 core field types into the field registry.
  const fieldRegistry = strapi.plugin('forms').service('fieldRegistry');
  registerCoreFieldTypes(fieldRegistry);

  // 2. Pick the webhook dispatcher implementation based on env.
  const webhookDispatcher = strapi.plugin('forms').service('webhookDispatcher');
  await webhookDispatcher.init?.();
};

export default bootstrap;

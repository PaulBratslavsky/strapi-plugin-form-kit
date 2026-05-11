import type { Core } from '@strapi/strapi';
import { runPluginMigrations } from './database/run-migrations';

const register = async ({ strapi }: { strapi: Core.Strapi }) => {
  strapi.log.debug('[strapi-plugin-forms] register()');
  await runPluginMigrations({ strapi });
};

export default register;

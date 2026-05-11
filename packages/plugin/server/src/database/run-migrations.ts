import type { Core } from '@strapi/strapi';
import * as createDeliveryLogs from './migrations/0001-create-delivery-logs';

/**
 * Plugin migrations are applied at register-time so subsequent services can rely on
 * the tables existing. Each migration is idempotent (uses hasTable / IF NOT EXISTS).
 */
export const runPluginMigrations = async ({ strapi }: { strapi: Core.Strapi }) => {
  const knex = strapi.db.connection;
  try {
    await createDeliveryLogs.up(knex);
    strapi.log.debug('[strapi-plugin-forms] delivery-log migrations applied');
  } catch (err) {
    strapi.log.error('[strapi-plugin-forms] failed to apply migrations: ' + (err as Error).message);
    throw err;
  }
};

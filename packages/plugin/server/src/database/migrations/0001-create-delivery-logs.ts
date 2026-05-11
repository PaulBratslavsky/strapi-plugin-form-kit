import type { Knex } from 'knex';

/**
 * Plugin-managed Knex migration. Strapi v5 picks this up via the plugin's `register` hook
 * (see register.ts) and applies it on startup.
 *
 * Two delivery-log tables, one per dispatcher type. Both reference Strapi's plugin-owned
 * tables (`strapi_forms_webhook_configs`, `strapi_forms_notification_rules`,
 * `strapi_forms_submissions`) by integer id.
 */

const WEBHOOK = 'strapi_forms_webhook_delivery_log';
const NOTIFICATION = 'strapi_forms_notification_delivery_log';

export const up = async (knex: Knex): Promise<void> => {
  const hasWebhook = await knex.schema.hasTable(WEBHOOK);
  if (!hasWebhook) {
    await knex.schema.createTable(WEBHOOK, (table) => {
      table.uuid('id').primary();
      table.integer('webhook_config_id').notNullable();
      table.integer('submission_id').notNullable();
      table.integer('attempt_number').notNullable().defaultTo(1);
      table.string('status').notNullable();
      table.integer('http_status').nullable();
      table.text('response_body_preview').nullable();
      table.text('error_message').nullable();
      table.timestamp('attempted_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      table.integer('duration_ms').nullable();

      table.index(['webhook_config_id', 'attempted_at']);
      table.index(['submission_id']);
      table.index(['attempted_at']);
    });
  }

  const hasNotification = await knex.schema.hasTable(NOTIFICATION);
  if (!hasNotification) {
    await knex.schema.createTable(NOTIFICATION, (table) => {
      table.uuid('id').primary();
      table.integer('notification_rule_id').notNullable();
      table.integer('submission_id').notNullable();
      table.json('recipients').notNullable();
      table.string('status').notNullable();
      table.text('error_message').nullable();
      table.timestamp('attempted_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

      table.index(['notification_rule_id', 'attempted_at']);
      table.index(['submission_id']);
      table.index(['attempted_at']);
    });
  }
};

export const down = async (knex: Knex): Promise<void> => {
  await knex.schema.dropTableIfExists(WEBHOOK);
  await knex.schema.dropTableIfExists(NOTIFICATION);
};

export const TABLE_NAMES = {
  WEBHOOK,
  NOTIFICATION,
};

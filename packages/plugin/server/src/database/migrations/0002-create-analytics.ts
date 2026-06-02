import type { Knex } from 'knex';

/**
 * Analytics tables — raw events + sealed daily rollups. Both are Knex-direct
 * (not Strapi content types) for the same reasons as the delivery logs:
 * high-volume infra data the user never browses as rows, and we want compound
 * indexes for the rollup/range queries.
 *
 * Forms are referenced by `form_document_id` (the stable documentId string),
 * NOT the numeric id — submissions link to the published form's int id but the
 * admin queries the draft, so documentId is the only key stable across the
 * draft/publish split (same footgun the submission dispatchers avoid).
 */

const EVENTS = 'strapi_forms_events';
const ROLLUPS = 'strapi_forms_event_rollups';

export const up = async (knex: Knex): Promise<void> => {
  const hasEvents = await knex.schema.hasTable(EVENTS);
  if (!hasEvents) {
    await knex.schema.createTable(EVENTS, (table) => {
      table.uuid('id').primary();
      table.string('form_document_id').notNullable();
      table.string('session_id').notNullable();
      // view | start | field_change | field_error | submit_attempt
      table.string('type').notNullable();
      table.string('field_id').nullable();
      table.string('error_kind').nullable();
      // Daily-salted hash for unique-visitor counts; never the raw IP.
      table.string('ip_hash').nullable();
      table.text('user_agent').nullable();
      table.text('referrer').nullable();
      table.string('viewport').nullable();
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

      table.index(['form_document_id', 'created_at']);
      table.index(['form_document_id', 'session_id']);
      // Pruning past the retention window scans by timestamp alone.
      table.index(['created_at']);
    });
  }

  const hasRollups = await knex.schema.hasTable(ROLLUPS);
  if (!hasRollups) {
    await knex.schema.createTable(ROLLUPS, (table) => {
      table.uuid('id').primary();
      table.string('form_document_id').notNullable();
      // UTC calendar day, stored as 'YYYY-MM-DD'.
      table.string('day').notNullable();
      table.integer('views').notNullable().defaultTo(0);
      table.integer('starts').notNullable().defaultTo(0);
      table.integer('attempts').notNullable().defaultTo(0);
      table.integer('submits').notNullable().defaultTo(0);
      // Mean seconds from start → matched submit, over sessions that converted.
      table.float('avg_seconds').nullable();
      // [{ fieldId, label, reached, dropoff }] — see aggregate.ts.
      table.json('dropoff_by_field').nullable();
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

      table.unique(['form_document_id', 'day']);
      table.index(['form_document_id', 'day']);
    });
  }
};

export const down = async (knex: Knex): Promise<void> => {
  await knex.schema.dropTableIfExists(EVENTS);
  await knex.schema.dropTableIfExists(ROLLUPS);
};

export const TABLE_NAMES = {
  EVENTS,
  ROLLUPS,
};

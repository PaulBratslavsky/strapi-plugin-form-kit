/**
 * Plugin-extensible registry of form field types. Server-side singleton.
 *
 * Each entry conforms to the FieldTypeRegistration shape (see schemas/field-types.ts).
 * Registrations happen during plugin bootstrap (core types) and during host-project
 * bootstrap (custom types via `strapi.plugin('forms').service('fieldRegistry').register(...)`).
 */
import type { z } from 'zod';

export type StorageType = 'string' | 'number' | 'boolean' | 'json';

export type FieldTypeRegistration = {
  name: string;
  plugin: string;
  storageType: StorageType;
  valueSchema: z.ZodSchema;
  configSchema: z.ZodSchema;
  aiHint: string;
};

const registry = new Map<string, FieldTypeRegistration>();

const service = () => ({
  register(descriptor: FieldTypeRegistration) {
    if (registry.has(descriptor.name)) {
      throw new Error(`[strapi-plugin-forms] field type "${descriptor.name}" is already registered`);
    }
    registry.set(descriptor.name, descriptor);
  },

  list(): FieldTypeRegistration[] {
    return Array.from(registry.values());
  },

  get(name: string): FieldTypeRegistration | undefined {
    return registry.get(name);
  },

  validateValue(
    typeName: string,
    value: unknown
  ): { ok: true; value: unknown } | { ok: false; errors: string[] } {
    const entry = registry.get(typeName);
    if (!entry) {
      return { ok: false, errors: [`Unknown field type "${typeName}"`] };
    }
    const result = entry.valueSchema.safeParse(value);
    if (result.success) {
      return { ok: true, value: result.data };
    }
    return {
      ok: false,
      errors: result.error.issues.map((i) => i.message),
    };
  },

  /** Test-only: clear all registrations. */
  _reset() {
    registry.clear();
  },
});

export default service;
export type FieldRegistryService = ReturnType<typeof service>;

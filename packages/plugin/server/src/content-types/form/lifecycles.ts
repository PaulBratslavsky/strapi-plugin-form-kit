/**
 * Validate the form's `schema` JSON against the canonical FormSchema before each write.
 * Invalid schemas reject with field-level errors; valid ones pass through unchanged.
 */
import { errors } from '@strapi/utils';

const { ValidationError } = errors;

type LifecycleEvent = {
  params: {
    data?: Record<string, unknown>;
    where?: Record<string, unknown>;
  };
};

const validate = async (event: LifecycleEvent) => {
  const data = event.params.data;
  if (!data || data.schema === undefined || data.schema === null) {
    return;
  }

  const validator = strapi.plugin('forms').service('formSchemaValidator');
  const result = validator.validateSchema(data.schema);
  if (!result.ok) {
    throw new ValidationError('Invalid form schema', { errors: result.errors });
  }
  // Replace with the parsed (default-applied) schema so downstream consumers get a normalized doc.
  data.schema = result.schema;
};

export default {
  beforeCreate: validate,
  beforeUpdate: validate,
};

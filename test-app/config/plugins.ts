import type { Core } from '@strapi/strapi';

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Plugin => ({
  forms: {
    enabled: true,
    resolve: '../packages/plugin',
    config: {
      redisUrl: env('STRAPI_FORMS_REDIS_URL'),
      webhookRetryMax: env.int('STRAPI_FORMS_WEBHOOK_RETRY_MAX', 5),
      webhookHmacDefaultSecret: env('STRAPI_FORMS_WEBHOOK_HMAC_DEFAULT_SECRET'),
    },
  },
});

export default config;

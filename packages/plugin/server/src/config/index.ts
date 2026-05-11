export default {
  default: {
    /** Maximum retry attempts for webhook delivery (overridable via STRAPI_FORMS_WEBHOOK_RETRY_MAX). */
    webhookRetryMax: 5,
    /** When set, BullMQDispatcher is used instead of InlineDispatcher. */
    redisUrl: undefined as string | undefined,
    /** Default HMAC secret applied if a webhook config has none set. */
    webhookHmacDefaultSecret: undefined as string | undefined,
  },
  validator() {
    // Configuration is read from env at bootstrap; no static validation required.
  },
};

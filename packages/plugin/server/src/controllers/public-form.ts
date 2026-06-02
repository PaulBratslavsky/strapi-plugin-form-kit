import { errors } from '@strapi/utils';
import type { Core } from '@strapi/strapi';
import { resolveOptionsSources } from '../services/options-source-resolver';
import { findPublishedFormByIdOrSlug } from './shared/form-lookup';

const { NotFoundError } = errors;

/**
 * Public-facing endpoints. These are mounted at `/api/forms/...` and (by default)
 * require no auth — controlled per-form by `settings.authenticatedOnly`.
 */
const controller = ({ strapi }: { strapi: Core.Strapi }) => ({
  /**
   * GET /api/forms/:slug/schema — return the canonical form schema for a
   * published form. Used by the embed runtime on every page load.
   *
   * Caching strategy: never cache the response *body* in browsers (so
   * republishing in the admin reflects on every page view immediately),
   * but emit a strong ETag derived from `updatedAt` + `documentId` so
   * repeat fetches can short-circuit to 304 Not Modified. This matches
   * the pattern HubSpot/Typeform use — forms are always live, but
   * revalidation is cheap when nothing's changed.
   */
  async getSchema(ctx: any) {
    // The path param is named `:slug` but accepts either a slug or a
    // documentId — see findPublishedFormByIdOrSlug. Lets embedders pick
    // friendlier slugs without losing the option of stable IDs.
    const idOrSlug = ctx.params.slug;
    const form = await findPublishedFormByIdOrSlug(strapi, idOrSlug);
    if (!form) {
      throw new NotFoundError(`Form "${idOrSlug}" not found or not published.`);
    }

    if (form.schema?.settings?.authenticatedOnly && !ctx.state.user) {
      ctx.unauthorized('Authentication required to read this form.');
      return;
    }

    // Build an ETag from the form's last-modified moment. Browsers send
    // If-None-Match on repeat fetches; we return 304 if unchanged.
    // NOTE: Strapi's publish action sometimes updates `publishedAt` without
    // bumping `updatedAt`, so we have to take the max of both — otherwise
    // a republish that doesn't change `updatedAt` would keep returning 304
    // and the embed would never see the new content.
    const lastModified = Math.max(
      new Date(form.updatedAt ?? 0).getTime(),
      new Date(form.publishedAt ?? 0).getTime()
    );
    const etag = `W/"${form.documentId}-${lastModified || Date.now()}"`;
    ctx.set('Cache-Control', 'no-cache, must-revalidate');
    ctx.set('ETag', etag);
    if (ctx.request.headers['if-none-match'] === etag) {
      ctx.status = 304;
      return;
    }

    // Resolve any `optionsSource` references on choice fields against
    // their collections. Static `options` arrays pass through untouched.
    const resolvedSchema = await resolveOptionsSources(strapi, form.schema);

    ctx.body = {
      schemaVersion: form.schema?.schemaVersion ?? 1,
      formId: form.documentId,
      slug: form.slug,
      schema: resolvedSchema,
      submissionUrl: `/api/forms/${form.slug}/submit`,
    };
  },

  /** POST /api/forms/:slug/submit — validate and persist a submission. */
  async submit(ctx: any) {
    const idOrSlug = ctx.params.slug;
    const body = ctx.request.body ?? {};
    const data = (body.data ?? {}) as Record<string, unknown>;
    const honeypot = body.honeypot;
    // Analytics session id — lets the rollup join this submission to its event
    // session for completion-rate and time-to-complete. Optional and best-effort.
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId.slice(0, 64) : null;

    const form = await findPublishedFormByIdOrSlug(strapi, idOrSlug);
    if (!form) {
      throw new NotFoundError(`Form "${idOrSlug}" not found or not published.`);
    }

    const settings = form.schema?.settings ?? {};
    if (settings.authenticatedOnly && !ctx.state.user) {
      ctx.unauthorized('Authentication required to submit this form.');
      return;
    }

    const honeypotEnabled = settings.honeypotEnabled ?? true;
    const honeypotTriggered =
      honeypotEnabled && typeof honeypot === 'string' && honeypot.trim() !== '';

    const metadata = {
      ip: ctx.request.ip,
      userAgent: ctx.request.headers['user-agent'] ?? null,
      referrer: ctx.request.headers.referer ?? ctx.request.headers.referrer ?? null,
      submittedAt: new Date().toISOString(),
      formSchemaVersion: form.schema?.schemaVersion ?? 1,
      ...(sessionId ? { sessionId } : {}),
    };

    // Honeypot path: persist as spam, return success regardless (so bots can't probe).
    if (honeypotTriggered) {
      await strapi.documents('plugin::forms.submission').create({
        data: {
          form: form.documentId as any,
          data: {},
          status: 'spam',
          metadata: { ...metadata, honeypot: true },
        },
      });
      ctx.status = 201;
      ctx.body = {
        submissionId: null,
        successMessage: settings.successMessage ?? 'Thank you for your submission.',
      };
      return;
    }

    // Validate the submission against the form's current schema. Fields
    // with `optionsSource` need their options resolved *before* validation
    // — otherwise the "value-in-options" check rejects anything submitted
    // since the stored schema only has the source reference, not the rows.
    const validatableSchema = await resolveOptionsSources(strapi, form.schema);
    const validator = strapi.plugin('forms').service('formSchemaValidator');
    const result = validator.validateSubmission({ schema: validatableSchema, data });

    if (!result.ok) {
      ctx.status = 400;
      ctx.body = { errors: result.errors };
      return;
    }

    const submission = await strapi.documents('plugin::forms.submission').create({
      data: {
        form: form.documentId as any,
        data: result.data,
        status: 'submitted',
        metadata,
      },
    });

    // Side effects: notifications + webhooks. These are fire-and-forget for the public response.
    // Errors inside the dispatchers are logged to delivery_log tables (M6/M7) but never propagate.
    try {
      await strapi.plugin('forms').service('notificationDispatcher').dispatchAllForSubmission?.({
        formDocumentId: form.documentId,
        submissionId: submission.id,
      });
    } catch (err) {
      strapi.log.warn(`[strapi-plugin-forms] notification dispatch failed: ${(err as Error).message}`);
    }
    try {
      await strapi.plugin('forms').service('webhookDispatcher').dispatchAllForSubmission?.({
        formDocumentId: form.documentId,
        submissionId: submission.id,
        payload: {
          formId: form.documentId,
          formSlug: form.slug,
          submissionId: submission.documentId,
          data: result.data,
          submittedAt: metadata.submittedAt,
        },
      });
    } catch (err) {
      strapi.log.warn(`[strapi-plugin-forms] webhook dispatch failed: ${(err as Error).message}`);
    }

    ctx.status = 201;
    ctx.body = {
      submissionId: submission.documentId,
      successMessage: settings.successMessage ?? 'Thank you for your submission.',
    };
  },
});

export default controller;

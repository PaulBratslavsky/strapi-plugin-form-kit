/**
 * Barrel for the admin API hooks.
 *
 * `useFormsApi()` composes the per-domain hooks into one object so existing
 * call sites (`const { listForms, aiStream } = useFormsApi()`) keep working
 * verbatim — the split is purely organisational. New code can also import
 * the focused hooks directly (`useAiApi`, `useSubmissionsApi`, …) to avoid
 * instantiating callbacks it doesn't use.
 */
export * from './shared';
export { useFormsCrudApi } from './forms';
export { useSubmissionsApi } from './submissions';
export { useNotificationsApi } from './notifications';
export { useWebhooksApi } from './webhooks';
export { useAiApi } from './ai';

import { useFormsCrudApi } from './forms';
import { useSubmissionsApi } from './submissions';
import { useNotificationsApi } from './notifications';
import { useWebhooksApi } from './webhooks';
import { useAiApi } from './ai';

export const useFormsApi = () => ({
  ...useFormsCrudApi(),
  ...useSubmissionsApi(),
  ...useNotificationsApi(),
  ...useWebhooksApi(),
  ...useAiApi(),
});

import { useCallback } from 'react';
import { useFetchClient } from '@strapi/strapi/admin';
import { PREFIX } from './shared';

export const useWebhooksApi = () => {
  const { get, post, put, del } = useFetchClient();

  const listWebhooks = useCallback(
    async (formDocumentId: string) => {
      const r = await get(`${PREFIX}/forms/${formDocumentId}/webhooks`);
      return r.data?.data ?? [];
    },
    [get]
  );

  const createWebhook = useCallback(
    async (formDocumentId: string, data: any) => {
      const r = await post(`${PREFIX}/forms/${formDocumentId}/webhooks`, { data });
      return r.data?.data;
    },
    [post]
  );

  const updateWebhook = useCallback(
    async (id: number, data: any) => {
      const r = await put(`${PREFIX}/webhooks/${id}`, { data });
      return r.data?.data;
    },
    [put]
  );

  const deleteWebhook = useCallback(
    async (id: number) => {
      await del(`${PREFIX}/webhooks/${id}`);
    },
    [del]
  );

  const listWebhookDeliveries = useCallback(
    async (id: number) => {
      const r = await get(`${PREFIX}/webhooks/${id}/deliveries`);
      return r.data?.data ?? [];
    },
    [get]
  );

  return {
    listWebhooks,
    createWebhook,
    updateWebhook,
    deleteWebhook,
    listWebhookDeliveries,
  };
};

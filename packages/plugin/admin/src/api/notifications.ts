import { useCallback } from 'react';
import { useFetchClient } from '@strapi/strapi/admin';
import { PREFIX } from './shared';

export const useNotificationsApi = () => {
  const { get, post, put, del } = useFetchClient();

  const listNotificationRules = useCallback(
    async (formDocumentId: string) => {
      const r = await get(`${PREFIX}/forms/${formDocumentId}/notifications`);
      return r.data?.data ?? [];
    },
    [get]
  );

  const createNotificationRule = useCallback(
    async (formDocumentId: string, data: any) => {
      const r = await post(`${PREFIX}/forms/${formDocumentId}/notifications`, { data });
      return r.data?.data;
    },
    [post]
  );

  const updateNotificationRule = useCallback(
    async (id: number, data: any) => {
      const r = await put(`${PREFIX}/notifications/${id}`, { data });
      return r.data?.data;
    },
    [put]
  );

  const deleteNotificationRule = useCallback(
    async (id: number) => {
      await del(`${PREFIX}/notifications/${id}`);
    },
    [del]
  );

  const listNotificationDeliveries = useCallback(
    async (id: number) => {
      const r = await get(`${PREFIX}/notifications/${id}/deliveries`);
      return r.data?.data ?? [];
    },
    [get]
  );

  return {
    listNotificationRules,
    createNotificationRule,
    updateNotificationRule,
    deleteNotificationRule,
    listNotificationDeliveries,
  };
};

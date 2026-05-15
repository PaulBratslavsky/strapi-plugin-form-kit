import { useCallback } from 'react';
import { useFetchClient } from '@strapi/strapi/admin';
import { PREFIX } from './shared';

export const useSubmissionsApi = () => {
  const { get, post, del } = useFetchClient();

  const listSubmissions = useCallback(
    async (
      formDocumentId: string,
      params: {
        status?: string;
        q?: string;
        from?: string;
        to?: string;
        page?: number;
        pageSize?: number;
      } = {}
    ) => {
      const search = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== '' && v !== null) search.set(k, String(v));
      });
      const r = await get(
        `${PREFIX}/forms/${formDocumentId}/submissions${
          search.toString() ? `?${search.toString()}` : ''
        }`
      );
      return r.data;
    },
    [get]
  );

  const setSubmissionStatus = useCallback(
    async (documentId: string, status: 'submitted' | 'read' | 'spam') => {
      const r = await post(`${PREFIX}/submissions/${documentId}/status`, { status });
      return r.data?.data;
    },
    [post]
  );

  const bulkSubmissions = useCallback(
    async (action: string, documentIds: string[]) => {
      const r = await post(`${PREFIX}/submissions/bulk`, { action, documentIds });
      return r.data?.data;
    },
    [post]
  );

  const deleteSubmission = useCallback(
    async (documentId: string) => {
      await del(`${PREFIX}/submissions/${documentId}`);
    },
    [del]
  );

  return { listSubmissions, setSubmissionStatus, bulkSubmissions, deleteSubmission };
};

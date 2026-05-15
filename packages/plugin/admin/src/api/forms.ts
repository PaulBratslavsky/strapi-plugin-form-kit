import { useCallback } from 'react';
import { useFetchClient } from '@strapi/strapi/admin';
import {
  PREFIX,
  type ContentTypeEntry,
  type FieldTypeEntry,
  type FormDocument,
  type FormListEntry,
} from './shared';

/**
 * Form CRUD + builder-support endpoints (field types, content types for
 * the optionsSource picker, AI-prompt copy, sidebar badge).
 */
export const useFormsCrudApi = () => {
  const { get, post, put, del } = useFetchClient();

  const listForms = useCallback(
    async (q?: string): Promise<FormListEntry[]> => {
      const r = await get(`${PREFIX}/forms${q ? `?q=${encodeURIComponent(q)}` : ''}`);
      return r.data?.data ?? [];
    },
    [get]
  );

  const getForm = useCallback(
    async (documentId: string): Promise<FormDocument> => {
      const r = await get(`${PREFIX}/forms/${documentId}`);
      return r.data?.data;
    },
    [get]
  );

  const createForm = useCallback(
    async (data: Partial<FormDocument>): Promise<FormDocument> => {
      const r = await post(`${PREFIX}/forms`, { data });
      return r.data?.data;
    },
    [post]
  );

  const updateForm = useCallback(
    async (documentId: string, data: Partial<FormDocument>): Promise<FormDocument> => {
      const r = await put(`${PREFIX}/forms/${documentId}`, { data });
      return r.data?.data;
    },
    [put]
  );

  const publishForm = useCallback(
    async (documentId: string, action: 'publish' | 'unpublish' = 'publish') => {
      const r = await post(`${PREFIX}/forms/${documentId}/publish`, { action });
      return r.data?.data;
    },
    [post]
  );

  const duplicateForm = useCallback(
    async (documentId: string) => {
      const r = await post(`${PREFIX}/forms/${documentId}/duplicate`, {});
      return r.data?.data;
    },
    [post]
  );

  const deleteForm = useCallback(
    async (documentId: string) => {
      await del(`${PREFIX}/forms/${documentId}`);
    },
    [del]
  );

  const listFieldTypes = useCallback(async (): Promise<FieldTypeEntry[]> => {
    const r = await get(`${PREFIX}/field-types`);
    return r.data?.data ?? [];
  }, [get]);

  const listContentTypes = useCallback(async (): Promise<ContentTypeEntry[]> => {
    const r = await get(`${PREFIX}/content-types`);
    return r.data?.data ?? [];
  }, [get]);

  const resolveOptionsSource = useCallback(
    async (args: {
      uid: string;
      labelField: string;
      valueField?: string;
    }): Promise<Array<{ label: string; value: string }>> => {
      const r = await post(`${PREFIX}/resolve-options-source`, args);
      return r.data?.data ?? [];
    },
    [post]
  );

  const sidebarBadge = useCallback(async () => {
    const r = await get(`${PREFIX}/sidebar-badge`);
    return r.data?.data?.newSubmissions ?? 0;
  }, [get]);

  const getAiPrompt = useCallback(
    async (documentId: string): Promise<string> => {
      const r = await get(`${PREFIX}/forms/${documentId}/copy-as-ai-prompt`);
      return r.data?.data?.prompt ?? '';
    },
    [get]
  );

  return {
    listForms,
    getForm,
    createForm,
    updateForm,
    publishForm,
    duplicateForm,
    deleteForm,
    listFieldTypes,
    listContentTypes,
    resolveOptionsSource,
    sidebarBadge,
    getAiPrompt,
  };
};

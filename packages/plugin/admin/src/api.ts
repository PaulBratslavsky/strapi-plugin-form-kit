import { useCallback } from 'react';
import { useFetchClient } from '@strapi/strapi/admin';
import { PLUGIN_ID } from './pluginId';

const PREFIX = `/${PLUGIN_ID}/admin`;

/**
 * Mirror of `@strapi/admin`'s getToken() — reads the admin JWT from
 * localStorage (preferred, JSON-encoded) with cookie fallback. We can't
 * import their helper because it's not in the public package surface.
 */
const readAdminJwt = (): string | null => {
  try {
    const raw = window.localStorage.getItem('jwtToken');
    if (raw) return JSON.parse(raw);
  } catch {
    /* fall through */
  }
  const m = document.cookie.match(/(?:^|;\s*)jwtToken=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
};

export type FormListEntry = {
  documentId: string;
  name: string;
  slug: string;
  description: string | null;
  publishedAt: string | null;
  updatedAt: string;
  fieldCount: number;
  submissionCount: number;
  newSubmissionCount: number;
};

export type FormDocument = {
  documentId: string;
  name: string;
  slug: string;
  description?: string | null;
  schema: any;
  publishedAt?: string | null;
  updatedAt?: string;
  createdAt?: string;
};

export type FieldTypeEntry = {
  name: string;
  plugin: string;
  storageType: 'string' | 'number' | 'boolean' | 'json';
  aiHint: string;
};

export type ContentTypeEntry = {
  uid: string;
  displayName: string;
  kind: 'collectionType' | 'singleType';
  /** Attribute names of type string/text/uid/email — candidates for labelField. */
  stringAttributes: string[];
};

/**
 * Thin wrapper around `useFetchClient` so callers don't repeat the prefix or unwrap
 * `data` themselves. Returns memoised callbacks safe for use in React effects.
 */
export const useFormsApi = () => {
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

  const listSubmissions = useCallback(
    async (
      formDocumentId: string,
      params: { status?: string; q?: string; from?: string; to?: string; page?: number; pageSize?: number } = {}
    ) => {
      const search = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== '' && v !== null) search.set(k, String(v));
      });
      const r = await get(
        `${PREFIX}/forms/${formDocumentId}/submissions${search.toString() ? `?${search.toString()}` : ''}`
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

  // ---- AI builder (Phase 2) ----

  const aiGenerate = useCallback(
    async (prompt: string): Promise<{ schema: any } | { error: string }> => {
      try {
        const r = await post(`${PREFIX}/ai/generate`, { prompt });
        return { schema: r.data?.data?.schema };
      } catch (err: any) {
        return { error: err?.response?.data?.error?.message ?? err?.message ?? 'AI request failed' };
      }
    },
    [post]
  );

  const aiRefine = useCallback(
    async (instruction: string, currentSchema: any): Promise<{ schema: any } | { error: string }> => {
      try {
        const r = await post(`${PREFIX}/ai/refine`, { instruction, currentSchema });
        return { schema: r.data?.data?.schema };
      } catch (err: any) {
        return { error: err?.response?.data?.error?.message ?? err?.message ?? 'AI request failed' };
      }
    },
    [post]
  );

  /**
   * Streaming generate/refine via SSE. Returns an abort function. The caller
   * gets token-by-token deltas via onChunk, and the final parsed schema via
   * onDone. We use plain fetch + ReadableStream so we control the parser —
   * useFetchClient doesn't expose the response body for streaming. We have
   * to read Strapi's admin JWT manually for the Authorization header (same
   * place getFetchClient.mjs in @strapi/admin pulls it from).
   */
  const aiStream = useCallback(
    (
      args: {
        target: 'layout' | 'style';
        mode: 'generate' | 'refine';
        prompt: string;
        currentSchema?: any;
        currentTheme?: any;
      },
      handlers: {
        onChunk: (text: string) => void;
        onDone: (result: { target: 'layout'; schema: any } | { target: 'style'; theme: any }) => void;
        onError: (msg: string) => void;
      }
    ) => {
      const ctrl = new AbortController();
      (async () => {
        try {
          const token = readAdminJwt();
          const res = await fetch(`${PREFIX}/ai/stream`, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(args),
            signal: ctrl.signal,
          });
          if (!res.ok || !res.body) {
            handlers.onError(`HTTP ${res.status}`);
            return;
          }
          const reader = res.body.getReader();
          const dec = new TextDecoder();
          let buffer = '';
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += dec.decode(value, { stream: true });
            // SSE frames are separated by blank lines.
            const frames = buffer.split('\n\n');
            buffer = frames.pop() ?? '';
            for (const frame of frames) {
              const line = frame.split('\n').find((l) => l.startsWith('data:'));
              if (!line) continue;
              const payload = line.slice(5).trim();
              if (!payload) continue;
              try {
                const evt = JSON.parse(payload);
                if (evt.type === 'chunk') handlers.onChunk(evt.text ?? '');
                else if (evt.type === 'done') {
                  if (evt.target === 'style') handlers.onDone({ target: 'style', theme: evt.theme });
                  else handlers.onDone({ target: 'layout', schema: evt.schema });
                } else if (evt.type === 'error') handlers.onError(evt.error ?? 'Stream error');
              } catch {
                // Ignore unparseable frames — the stream may include keep-alives.
              }
            }
          }
        } catch (err: any) {
          if (err?.name !== 'AbortError') handlers.onError(err?.message ?? 'Stream failed');
        }
      })();
      return () => ctrl.abort();
    },
    []
  );

  const aiHealth = useCallback(async () => {
    const r = await get(`${PREFIX}/ai/health`);
    return r.data?.data as { ok: boolean; error?: string };
  }, [get]);

  const aiGetConfig = useCallback(async () => {
    const r = await get(`${PREFIX}/ai/config`);
    return r.data?.data as {
      provider: 'none' | 'anthropic' | 'openai' | 'ollama' | 'mock';
      baseUrl?: string;
      model?: string;
      apiKeyConfigured: boolean;
      envOverridden: boolean;
    };
  }, [get]);

  const aiUpdateConfig = useCallback(
    async (data: {
      provider?: string;
      apiKey?: string | null;
      baseUrl?: string | null;
      model?: string | null;
    }) => {
      const r = await put(`${PREFIX}/ai/config`, { data });
      return r.data?.data;
    },
    [put]
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
    listNotificationRules,
    createNotificationRule,
    updateNotificationRule,
    deleteNotificationRule,
    listNotificationDeliveries,
    listWebhooks,
    createWebhook,
    updateWebhook,
    deleteWebhook,
    listWebhookDeliveries,
    listSubmissions,
    setSubmissionStatus,
    bulkSubmissions,
    deleteSubmission,
    sidebarBadge,
    getAiPrompt,
    aiGenerate,
    aiRefine,
    aiStream,
    aiHealth,
    aiGetConfig,
    aiUpdateConfig,
  };
};

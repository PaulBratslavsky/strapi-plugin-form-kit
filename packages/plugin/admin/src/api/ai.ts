import { useCallback } from 'react';
import { useFetchClient } from '@strapi/strapi/admin';
import { PREFIX, readAdminJwt } from './shared';

export const useAiApi = () => {
  const { get, post, put } = useFetchClient();

  const aiGenerate = useCallback(
    async (prompt: string): Promise<{ schema: any } | { error: string }> => {
      try {
        const r = await post(`${PREFIX}/ai/generate`, { prompt });
        return { schema: r.data?.data?.schema };
      } catch (err: any) {
        return {
          error: err?.response?.data?.error?.message ?? err?.message ?? 'AI request failed',
        };
      }
    },
    [post]
  );

  const aiRefine = useCallback(
    async (
      instruction: string,
      currentSchema: any
    ): Promise<{ schema: any } | { error: string }> => {
      try {
        const r = await post(`${PREFIX}/ai/refine`, { instruction, currentSchema });
        return { schema: r.data?.data?.schema };
      } catch (err: any) {
        return {
          error: err?.response?.data?.error?.message ?? err?.message ?? 'AI request failed',
        };
      }
    },
    [post]
  );

  /**
   * Streaming generate/refine via SSE. Returns an abort function. The caller
   * gets token-by-token deltas via onChunk, the final result via onDone. We
   * use plain fetch + ReadableStream so we control the parser — useFetchClient
   * wraps axios and can't expose response.body. The admin JWT is read manually
   * for the Authorization header (same source @strapi/admin's getToken uses).
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
        onDone: (
          result: { target: 'layout'; schema: any } | { target: 'style'; theme: any }
        ) => void;
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
                  if (evt.target === 'style')
                    handlers.onDone({ target: 'style', theme: evt.theme });
                  else handlers.onDone({ target: 'layout', schema: evt.schema });
                } else if (evt.type === 'error')
                  handlers.onError(evt.error ?? 'Stream error');
              } catch {
                // Ignore unparseable frames — stream may include keep-alives.
              }
            }
          }
        } catch (err: any) {
          if (err?.name !== 'AbortError')
            handlers.onError(err?.message ?? 'Stream failed');
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

  return { aiGenerate, aiRefine, aiStream, aiHealth, aiGetConfig, aiUpdateConfig };
};

/**
 * Plugin settings sub-page for the AI provider. Lives at
 * /plugins/forms/settings (the existing settings page route).
 *
 * Render priority is the env-var-overridden case: if production set
 * STRAPI_FORMS_AI_PROVIDER + key, this page becomes read-only and tells
 * the user where the values are coming from.
 */
import { useEffect, useState } from 'react';
import styled from 'styled-components';
import {
  Main,
  Box,
  Typography,
  Field,
  Button,
  SingleSelect,
  SingleSelectOption,
  Flex,
} from '@strapi/design-system';
import { Check, Cross } from '@strapi/icons';
import { useFormsApi } from '../api';

type Provider = 'none' | 'anthropic' | 'openai' | 'ollama' | 'mock';

const DEFAULT_MODELS: Record<Provider, string> = {
  none: '',
  mock: '',
  anthropic: 'claude-haiku-4-5-20251001',
  openai: 'gpt-4o-mini',
  ollama: 'llama3',
};

const Section = styled.div`
  max-width: 640px;
`;

const Banner = styled.div<{ $tone: 'info' | 'success' | 'danger' }>`
  padding: 12px 14px;
  border-radius: 8px;
  margin-bottom: 16px;
  background: ${({ $tone, theme }) =>
    $tone === 'info'
      ? theme?.colors?.primary100 ?? '#f0f0ff'
      : $tone === 'success'
        ? theme?.colors?.success100 ?? '#eafbe7'
        : theme?.colors?.danger100 ?? '#fcecea'};
  color: ${({ $tone, theme }) =>
    $tone === 'info'
      ? theme?.colors?.primary700 ?? '#271fe0'
      : $tone === 'success'
        ? theme?.colors?.success700 ?? '#2f6846'
        : theme?.colors?.danger700 ?? '#a82215'};
  font-size: 0.875rem;
`;

export const AiSettingsPage = () => {
  const { aiGetConfig, aiUpdateConfig, aiHealth } = useFormsApi();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [config, setConfig] = useState<{
    provider: Provider;
    baseUrl?: string;
    model?: string;
    apiKeyConfigured: boolean;
    envOverridden: boolean;
  }>({ provider: 'none', apiKeyConfigured: false, envOverridden: false });
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [healthMsg, setHealthMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    aiGetConfig()
      .then((c) => {
        setConfig(c);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [aiGetConfig]);

  const onSave = async () => {
    setSaving(true);
    setSaveError(null);
    setSavedAt(null);
    try {
      const updated = await aiUpdateConfig({
        provider: config.provider,
        apiKey: apiKeyInput || undefined,
        baseUrl: config.baseUrl || null,
        model: config.model || null,
      });
      if (!updated || updated.provider !== config.provider) {
        setSaveError(
          'Save returned a different provider than was requested — DB persistence may have failed. Check Strapi server logs.'
        );
        return;
      }
      setConfig(updated);
      setApiKeyInput('');
      setShowKeyInput(false);
      setSavedAt(new Date().toLocaleTimeString());
    } catch (err: any) {
      setSaveError(err?.response?.data?.error?.message ?? err?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const onTest = async () => {
    setTesting(true);
    setHealthMsg(null);
    try {
      const r = await aiHealth();
      setHealthMsg({
        ok: r.ok,
        text: r.ok ? 'Provider responded successfully.' : (r.error ?? 'Provider unreachable.'),
      });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <Main>
        <Box padding={6}>
          <Typography>Loading…</Typography>
        </Box>
      </Main>
    );
  }

  return (
    <Main>
      <Box padding={6}>
        <Typography variant="alpha" tag="h1">
          AI builder
        </Typography>
        <Box marginTop={1} marginBottom={5}>
          <Typography variant="omega" textColor="neutral600">
            Bring your own API key. The plugin never sends form data outside your Strapi instance
            unless you call the AI explicitly.
          </Typography>
        </Box>

        <Section>
          {config.envOverridden && (
            <Banner $tone="info">
              Environment variables (<code>STRAPI_FORMS_AI_*</code>) are set and take precedence
              over this UI. Changes saved here will only apply once the env vars are removed.
            </Banner>
          )}
          {savedAt && <Banner $tone="success">Saved at {savedAt}.</Banner>}
          {saveError && <Banner $tone="danger">✕ {saveError}</Banner>}
          {healthMsg && (
            <Banner $tone={healthMsg.ok ? 'success' : 'danger'}>
              {healthMsg.ok ? '✓ ' : '✕ '}
              {healthMsg.text}
            </Banner>
          )}

          <Box marginBottom={4}>
            <Field.Root name="provider">
              <Field.Label>Provider</Field.Label>
              <SingleSelect
                value={config.provider}
                onChange={(v: any) =>
                  setConfig((c) => ({ ...c, provider: v as Provider }))
                }
              >
                <SingleSelectOption value="none">None — disable AI</SingleSelectOption>
                <SingleSelectOption value="anthropic">Anthropic (Claude)</SingleSelectOption>
                <SingleSelectOption value="openai">OpenAI (GPT)</SingleSelectOption>
                <SingleSelectOption value="ollama">Ollama (local)</SingleSelectOption>
                <SingleSelectOption value="mock">
                  Mock — for testing without an API key
                </SingleSelectOption>
              </SingleSelect>
            </Field.Root>
          </Box>

          {config.provider !== 'none' && config.provider !== 'mock' && (
            <>
              <Box marginBottom={4}>
                <Field.Root
                  name="apiKey"
                  hint={
                    config.provider === 'ollama'
                      ? 'Ollama ignores the key; anything works.'
                      : 'Required.'
                  }
                >
                  <Field.Label>API key</Field.Label>
                  {config.apiKeyConfigured && !showKeyInput ? (
                    <Flex gap={2} alignItems="center">
                      <Typography variant="omega" textColor="success600">
                        ✓ Key stored (encrypted)
                      </Typography>
                      <Button
                        variant="tertiary"
                        size="S"
                        onClick={() => setShowKeyInput(true)}
                      >
                        Replace
                      </Button>
                    </Flex>
                  ) : (
                    <>
                      <Field.Input
                        type="password"
                        value={apiKeyInput}
                        placeholder=""
                        onChange={(e: any) => setApiKeyInput(e.target.value)}
                      />
                      {config.apiKeyConfigured && (
                        <Box marginTop={1}>
                          <Button
                            variant="tertiary"
                            size="S"
                            onClick={() => {
                              setShowKeyInput(false);
                              setApiKeyInput('');
                            }}
                          >
                            Cancel — keep existing key
                          </Button>
                        </Box>
                      )}
                    </>
                  )}
                  <Field.Hint />
                </Field.Root>
              </Box>

              {config.provider === 'ollama' && (
                <Box marginBottom={4}>
                  <Field.Root
                    name="baseUrl"
                    hint='Ollama OpenAI-compatible endpoint. Default: http://localhost:11434/v1'
                  >
                    <Field.Label>Base URL</Field.Label>
                    <Field.Input
                      value={config.baseUrl ?? ''}
                      placeholder="http://localhost:11434/v1"
                      onChange={(e: any) =>
                        setConfig((c) => ({ ...c, baseUrl: e.target.value }))
                      }
                    />
                    <Field.Hint />
                  </Field.Root>
                </Box>
              )}

              <Box marginBottom={4}>
                <Field.Root name="model" hint={`Default: ${DEFAULT_MODELS[config.provider]}`}>
                  <Field.Label>Model</Field.Label>
                  <Field.Input
                    value={config.model ?? ''}
                    placeholder={DEFAULT_MODELS[config.provider]}
                    onChange={(e: any) => setConfig((c) => ({ ...c, model: e.target.value }))}
                  />
                  <Field.Hint />
                </Field.Root>
              </Box>
            </>
          )}

          <Flex gap={2}>
            <Button onClick={onSave} loading={saving}>
              Save
            </Button>
            <Button
              variant="secondary"
              onClick={onTest}
              loading={testing}
              disabled={config.provider === 'none'}
              startIcon={healthMsg?.ok ? <Check /> : healthMsg && !healthMsg.ok ? <Cross /> : undefined}
            >
              Test connection
            </Button>
          </Flex>
        </Section>
      </Box>
    </Main>
  );
};

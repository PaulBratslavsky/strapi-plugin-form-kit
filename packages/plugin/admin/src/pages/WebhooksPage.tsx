import { useEffect, useState } from 'react';
import {
  Main,
  Box,
  Typography,
  Button,
  Flex,
  TextInput,
  Toggle,
  Loader,
  SingleSelect,
  SingleSelectOption,
} from '@strapi/design-system';
import { ArrowLeft, Plus, Trash } from '@strapi/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { useFormsApi } from '../api';

type Hook = {
  id: number;
  name: string;
  url: string;
  method: 'POST' | 'PUT';
  headers: Record<string, string>;
  enabled: boolean;
  hmacConfigured: boolean;
};

const HookEditor = ({
  hook,
  onChange,
  onDelete,
  onShowDeliveries,
  deliveries,
}: {
  hook: Hook;
  onChange: (patch: Partial<Hook> & { hmacSecret?: string | null }) => Promise<void> | void;
  onDelete: () => Promise<void> | void;
  onShowDeliveries: () => Promise<void>;
  deliveries: any[] | null;
}) => {
  const [hmacInput, setHmacInput] = useState('');

  return (
    <Box hasRadius padding={4} background="neutral0" borderColor="neutral200" marginBottom={4}>
      <Flex justifyContent="space-between" alignItems="flex-start">
        <Box flex="1">
          <TextInput
            label="Name"
            name={`name-${hook.id}`}
            value={hook.name}
            onChange={(e: any) => onChange({ name: e.target.value })}
          />
          <Box marginTop={3}>
            <TextInput
              label="URL"
              name={`url-${hook.id}`}
              value={hook.url}
              onChange={(e: any) => onChange({ url: e.target.value })}
            />
          </Box>
          <Box marginTop={3}>
            <SingleSelect
              label="Method"
              value={hook.method}
              onChange={(v: any) => onChange({ method: v as 'POST' | 'PUT' })}
            >
              <SingleSelectOption value="POST">POST</SingleSelectOption>
              <SingleSelectOption value="PUT">PUT</SingleSelectOption>
            </SingleSelect>
          </Box>
          <Box marginTop={3}>
            <Flex gap={2} alignItems="end">
              <Box flex="1">
                <TextInput
                  label="HMAC secret (write-only)"
                  name={`hmac-${hook.id}`}
                  type="password"
                  value={hmacInput}
                  hint={
                    hook.hmacConfigured
                      ? 'A secret is configured. Enter a new value to rotate, or "clear" to remove.'
                      : 'Optional. When set, requests include an X-Strapi-Forms-Signature: sha256=… header.'
                  }
                  onChange={(e: any) => setHmacInput(e.target.value)}
                />
              </Box>
              <Button
                variant="secondary"
                onClick={() => {
                  if (!hmacInput) return;
                  if (hmacInput === 'clear') {
                    onChange({ hmacSecret: null });
                  } else {
                    onChange({ hmacSecret: hmacInput });
                  }
                  setHmacInput('');
                }}
              >
                Save secret
              </Button>
            </Flex>
          </Box>
          <Box hasRadius padding={3} background="neutral100" borderColor="neutral200" marginTop={3}>
            <Flex justifyContent="space-between" alignItems="center" gap={3}>
              <Box flex="1">
                <Typography variant="omega" fontWeight="bold" tag="div">
                  Enabled
                </Typography>
                <Box marginTop={1}>
                  <Typography variant="pi" textColor="neutral600" tag="div">
                    Quick toggle without deleting the webhook
                  </Typography>
                </Box>
              </Box>
              <Toggle
                aria-label="Enabled"
                checked={hook.enabled}
                onChange={() => onChange({ enabled: !hook.enabled })}
              />
            </Flex>
          </Box>
        </Box>
        <Flex direction="column" gap={2} marginLeft={4}>
          <Button variant="tertiary" size="S" onClick={onShowDeliveries}>
            Recent deliveries
          </Button>
          <Button variant="danger-light" size="S" startIcon={<Trash />} onClick={onDelete}>
            Delete
          </Button>
        </Flex>
      </Flex>
      {deliveries && (
        <Box marginTop={3} padding={3} background="neutral100" hasRadius>
          <Typography variant="sigma">Recent deliveries (last 100)</Typography>
          {deliveries.length === 0 ? (
            <Typography variant="pi" textColor="neutral600">
              No deliveries yet.
            </Typography>
          ) : (
            <Box marginTop={2}>
              {deliveries.map((d: any) => (
                <Box key={d.id} marginBottom={1}>
                  <Typography variant="pi">
                    [{d.attempted_at}] attempt {d.attempt_number} · {d.status}
                    {d.http_status ? ` (${d.http_status})` : ''}
                    {d.error_message ? ` — ${d.error_message}` : ''}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};

export const WebhooksPage = () => {
  const { documentId = '' } = useParams<{ documentId: string }>();
  const navigate = useNavigate();
  const {
    listWebhooks,
    createWebhook,
    updateWebhook,
    deleteWebhook,
    listWebhookDeliveries,
  } = useFormsApi();
  const [hooks, setHooks] = useState<Hook[]>([]);
  const [loading, setLoading] = useState(true);
  const [deliveries, setDeliveries] = useState<Record<number, any[] | null>>({});

  const load = async () => {
    setLoading(true);
    try {
      setHooks(await listWebhooks(documentId));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [documentId]);

  const onAdd = async () => {
    const created = await createWebhook(documentId, {
      name: 'New webhook',
      url: 'https://webhook.site/your-test-url',
      method: 'POST',
      enabled: true,
    });
    setHooks([...hooks, created]);
  };

  const onChange = async (
    hook: Hook,
    patch: Partial<Hook> & { hmacSecret?: string | null }
  ) => {
    const updated = await updateWebhook(hook.id, patch);
    setHooks(hooks.map((h) => (h.id === hook.id ? { ...h, ...updated } : h)));
  };

  const onDelete = async (hook: Hook) => {
    if (!window.confirm('Delete this webhook?')) return;
    await deleteWebhook(hook.id);
    setHooks(hooks.filter((h) => h.id !== hook.id));
  };

  const onShowDeliveries = async (hook: Hook) => {
    const list = await listWebhookDeliveries(hook.id);
    setDeliveries({ ...deliveries, [hook.id]: list });
  };

  return (
    <Main>
      <Box padding={6}>
        <Flex gap={3} alignItems="center">
          <Button variant="tertiary" startIcon={<ArrowLeft />} onClick={() => navigate('..')}>
            Back to builder
          </Button>
          <Typography variant="alpha" tag="h1">
            Webhooks
          </Typography>
        </Flex>

        <Box marginTop={4}>
          <Button startIcon={<Plus />} onClick={onAdd}>
            Add webhook
          </Button>
        </Box>

        <Box marginTop={5}>
          {loading ? (
            <Flex justifyContent="center" padding={6}>
              <Loader />
            </Flex>
          ) : hooks.length === 0 ? (
            <Typography textColor="neutral600">No webhooks configured.</Typography>
          ) : (
            hooks.map((hook) => (
              <HookEditor
                key={hook.id}
                hook={hook}
                onChange={(patch) => onChange(hook, patch)}
                onDelete={() => onDelete(hook)}
                onShowDeliveries={() => onShowDeliveries(hook)}
                deliveries={deliveries[hook.id] ?? null}
              />
            ))
          )}
        </Box>
      </Box>
    </Main>
  );
};

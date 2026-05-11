import { useEffect, useState } from 'react';
import {
  Main,
  Box,
  Typography,
  Button,
  Flex,
  TextInput,
  Textarea,
  Toggle,
  Loader,
} from '@strapi/design-system';
import { ArrowLeft, Plus, Trash } from '@strapi/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { useFormsApi } from '../api';

type Rule = {
  id: number;
  name: string;
  recipients: string[];
  subjectTemplate: string;
  bodyTemplate: string;
  enabled: boolean;
};

const RuleEditor = ({
  rule,
  onChange,
  onDelete,
  onShowDeliveries,
  deliveries,
}: {
  rule: Rule;
  onChange: (patch: Partial<Rule>) => Promise<void> | void;
  onDelete: () => Promise<void> | void;
  onShowDeliveries: () => Promise<void>;
  deliveries: any[] | null;
}) => {
  const [recipientsText, setRecipientsText] = useState(rule.recipients.join(', '));

  return (
    <Box hasRadius padding={4} background="neutral0" borderColor="neutral200" marginBottom={4}>
      <Flex justifyContent="space-between" alignItems="flex-start">
        <Box flex="1">
          <TextInput
            label="Rule name"
            name={`name-${rule.id}`}
            value={rule.name}
            onChange={(e: any) => onChange({ name: e.target.value })}
          />
          <Box marginTop={3}>
            <TextInput
              label="Recipients (comma-separated)"
              name={`recipients-${rule.id}`}
              value={recipientsText}
              onChange={(e: any) => setRecipientsText(e.target.value)}
              onBlur={() =>
                onChange({
                  recipients: recipientsText
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              hint="One or more email addresses, e.g. sales@acme.com, ops@acme.com"
            />
          </Box>
          <Box marginTop={3}>
            <TextInput
              label="Subject"
              name={`subject-${rule.id}`}
              value={rule.subjectTemplate}
              hint="Supports {{fieldId}} and {{fieldLabel:fieldId}} placeholders"
              onChange={(e: any) => onChange({ subjectTemplate: e.target.value })}
            />
          </Box>
          <Box marginTop={3}>
            <Textarea
              label="Body"
              name={`body-${rule.id}`}
              value={rule.bodyTemplate}
              onChange={(e: any) => onChange({ bodyTemplate: e.target.value })}
            />
            <Typography variant="pi" textColor="neutral600">
              {`Use {{all}} to render every field as label: value lines.`}
            </Typography>
          </Box>
          <Box hasRadius padding={3} background="neutral100" borderColor="neutral200" marginTop={3}>
            <Flex justifyContent="space-between" alignItems="center" gap={3}>
              <Box flex="1">
                <Typography variant="omega" fontWeight="bold" tag="div">
                  Enabled
                </Typography>
                <Box marginTop={1}>
                  <Typography variant="pi" textColor="neutral600" tag="div">
                    Quick toggle without deleting the rule
                  </Typography>
                </Box>
              </Box>
              <Toggle
                aria-label="Enabled"
                checked={rule.enabled}
                onChange={() => onChange({ enabled: !rule.enabled })}
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
                    [{d.attempted_at}] {d.status}
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

export const NotificationsPage = () => {
  const { documentId = '' } = useParams<{ documentId: string }>();
  const navigate = useNavigate();
  const {
    listNotificationRules,
    createNotificationRule,
    updateNotificationRule,
    deleteNotificationRule,
    listNotificationDeliveries,
  } = useFormsApi();
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [deliveries, setDeliveries] = useState<Record<number, any[] | null>>({});

  const load = async () => {
    setLoading(true);
    try {
      const r = await listNotificationRules(documentId);
      setRules(r);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [documentId]);

  const onAdd = async () => {
    const created = await createNotificationRule(documentId, {
      name: 'Notify team',
      recipients: ['change-me@example.com'],
      subjectTemplate: 'New submission',
      bodyTemplate: '{{all}}',
      enabled: true,
    });
    setRules([...rules, created]);
  };

  const onChange = async (rule: Rule, patch: Partial<Rule>) => {
    const updated = await updateNotificationRule(rule.id, { ...rule, ...patch });
    setRules(rules.map((r) => (r.id === rule.id ? { ...r, ...patch, ...(updated ?? {}) } : r)));
  };

  const onDelete = async (rule: Rule) => {
    if (!window.confirm('Delete this rule?')) return;
    await deleteNotificationRule(rule.id);
    setRules(rules.filter((r) => r.id !== rule.id));
  };

  const onShowDeliveries = async (rule: Rule) => {
    const list = await listNotificationDeliveries(rule.id);
    setDeliveries({ ...deliveries, [rule.id]: list });
  };

  return (
    <Main>
      <Box padding={6}>
        <Flex gap={3} alignItems="center">
          <Button variant="tertiary" startIcon={<ArrowLeft />} onClick={() => navigate('..')}>
            Back to builder
          </Button>
          <Typography variant="alpha" tag="h1">
            Email notifications
          </Typography>
        </Flex>

        <Box marginTop={4}>
          <Button startIcon={<Plus />} onClick={onAdd}>
            Add notification rule
          </Button>
        </Box>

        <Box marginTop={5}>
          {loading ? (
            <Flex justifyContent="center" padding={6}>
              <Loader />
            </Flex>
          ) : rules.length === 0 ? (
            <Typography textColor="neutral600">No notification rules yet.</Typography>
          ) : (
            rules.map((rule) => (
              <RuleEditor
                key={rule.id}
                rule={rule}
                onChange={(patch) => onChange(rule, patch)}
                onDelete={() => onDelete(rule)}
                onShowDeliveries={() => onShowDeliveries(rule)}
                deliveries={deliveries[rule.id] ?? null}
              />
            ))
          )}
        </Box>
      </Box>
    </Main>
  );
};

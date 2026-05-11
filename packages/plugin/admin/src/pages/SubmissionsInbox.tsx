import { useEffect, useMemo, useState } from 'react';
import {
  Main,
  Box,
  Typography,
  Button,
  Flex,
  Loader,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Field,
  Modal,
  Badge,
  Checkbox,
} from '@strapi/design-system';
import { ArrowLeft, Download, Trash } from '@strapi/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { useFormsApi } from '../api';
import { PLUGIN_ID } from '../pluginId';
import { SubmissionDetailModal } from '../components/submissions/SubmissionDetailModal';

type Submission = {
  id: number;
  documentId: string;
  data: Record<string, unknown>;
  status: 'submitted' | 'read' | 'spam';
  metadata?: Record<string, unknown>;
  createdAt: string;
};

type Schema = { fields: Array<{ id: string; label: string; type: string }> };

const TABS: Array<'submitted' | 'read' | 'spam'> = ['submitted', 'read', 'spam'];

export const SubmissionsInbox = () => {
  const { formDocumentId = '' } = useParams<{ formDocumentId: string }>();
  const navigate = useNavigate();
  const {
    listSubmissions,
    setSubmissionStatus,
    bulkSubmissions,
    deleteSubmission,
  } = useFormsApi();

  const [items, setItems] = useState<Submission[]>([]);
  const [counts, setCounts] = useState({ submitted: 0, read: 0, spam: 0 });
  const [formMeta, setFormMeta] = useState<{ name: string; slug: string; schema: Schema } | null>(null);
  const [tab, setTab] = useState<'submitted' | 'read' | 'spam'>('submitted');
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openSubmission, setOpenSubmission] = useState<Submission | null>(null);

  const labelByFieldId = useMemo(() => {
    const m = new Map<string, string>();
    formMeta?.schema?.fields?.forEach((f) => m.set(f.id, f.label));
    return m;
  }, [formMeta]);

  const load = async () => {
    setLoading(true);
    try {
      const r = await listSubmissions(formDocumentId, { status: tab, q, from, to });
      setItems(r.data ?? []);
      setCounts(r.meta?.counts ?? counts);
      if (r.meta?.form) setFormMeta(r.meta.form);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    setSelected(new Set());
  }, [formDocumentId, tab]);

  const onSearch = async () => {
    await load();
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const onBulk = async (action: string) => {
    if (selected.size === 0) return;
    if (action === 'delete' && !window.confirm(`Delete ${selected.size} submissions?`)) return;
    await bulkSubmissions(action, Array.from(selected));
    setSelected(new Set());
    await load();
  };

  const onSetStatus = async (sub: Submission, status: 'submitted' | 'read' | 'spam') => {
    await setSubmissionStatus(sub.documentId, status);
    await load();
  };

  const onDelete = async (sub: Submission) => {
    if (!window.confirm('Delete this submission?')) return;
    await deleteSubmission(sub.documentId);
    await load();
  };

  const exportCsvUrl = `/${PLUGIN_ID}/admin/forms/${formDocumentId}/submissions/export.csv?status=${tab}${q ? `&q=${encodeURIComponent(q)}` : ''}${from ? `&from=${from}` : ''}${to ? `&to=${to}` : ''}`;

  return (
    <Main>
      <Box padding={6}>
        <Flex justifyContent="space-between" alignItems="center">
          <Flex gap={3} alignItems="center">
            <Button variant="tertiary" startIcon={<ArrowLeft />} onClick={() => navigate('..')}>
              Back to forms
            </Button>
            <Box>
              <Typography variant="alpha" tag="h1">
                {formMeta?.name ?? 'Submissions'}
              </Typography>
              <Typography variant="omega" textColor="neutral600">
                /api/forms/{formMeta?.slug ?? '…'}
              </Typography>
            </Box>
          </Flex>
          <Button
            variant="secondary"
            startIcon={<Download />}
            onClick={() => window.open(exportCsvUrl, '_blank')}
          >
            Export CSV
          </Button>
        </Flex>

        <Box marginTop={5}>
          <Flex gap={3}>
            {TABS.map((t) => (
              <Button
                key={t}
                variant={tab === t ? 'default' : 'tertiary'}
                onClick={() => setTab(t)}
              >
                {t === 'submitted' ? 'New' : t === 'read' ? 'Read' : 'Spam'}{' '}
                <Badge>{counts[t]}</Badge>
              </Button>
            ))}
          </Flex>
        </Box>

        <Box marginTop={4}>
          <Flex gap={3} alignItems="end">
            <Box flex="2">
              <Field.Root name="q">
                <Field.Label>Search</Field.Label>
                <Field.Input
                  placeholder="Search submission data…"
                  value={q}
                  onChange={(e: any) => setQ(e.target.value)}
                />
              </Field.Root>
            </Box>
            <Box flex="1">
              <Field.Root name="from">
                <Field.Label>From</Field.Label>
                <Field.Input
                  type="date"
                  value={from}
                  onChange={(e: any) => setFrom(e.target.value)}
                />
              </Field.Root>
            </Box>
            <Box flex="1">
              <Field.Root name="to">
                <Field.Label>To</Field.Label>
                <Field.Input
                  type="date"
                  value={to}
                  onChange={(e: any) => setTo(e.target.value)}
                />
              </Field.Root>
            </Box>
            <Button onClick={onSearch}>Apply</Button>
          </Flex>
        </Box>

        {selected.size > 0 && (
          <Box marginTop={4} padding={3} background="primary100" hasRadius>
            <Flex justifyContent="space-between" alignItems="center">
              <Typography>{selected.size} selected</Typography>
              <Flex gap={2}>
                <Button variant="secondary" onClick={() => onBulk('status:read')}>
                  Mark as read
                </Button>
                <Button variant="secondary" onClick={() => onBulk('status:spam')}>
                  Mark as spam
                </Button>
                <Button
                  variant="danger-light"
                  startIcon={<Trash />}
                  onClick={() => onBulk('delete')}
                >
                  Delete
                </Button>
              </Flex>
            </Flex>
          </Box>
        )}

        <Box marginTop={5}>
          {loading ? (
            <Flex justifyContent="center" padding={6}>
              <Loader />
            </Flex>
          ) : items.length === 0 ? (
            <Typography textColor="neutral600">No submissions in "{tab}".</Typography>
          ) : (
            <Table colCount={5} rowCount={items.length}>
              <Thead>
                <Tr>
                  <Th>
                    <Checkbox
                      checked={selected.size === items.length && items.length > 0}
                      onCheckedChange={(c: any) => {
                        if (c) setSelected(new Set(items.map((i) => i.documentId)));
                        else setSelected(new Set());
                      }}
                    />
                  </Th>
                  <Th>
                    <Typography variant="sigma">Submitted</Typography>
                  </Th>
                  <Th>
                    <Typography variant="sigma">Preview</Typography>
                  </Th>
                  <Th>
                    <Typography variant="sigma">Status</Typography>
                  </Th>
                  <Th>
                    <Typography variant="sigma">Actions</Typography>
                  </Th>
                </Tr>
              </Thead>
              <Tbody>
                {items.map((sub) => (
                  <Tr key={sub.documentId}>
                    <Td>
                      <Checkbox
                        checked={selected.has(sub.documentId)}
                        onCheckedChange={() => toggleSelect(sub.documentId)}
                      />
                    </Td>
                    <Td>
                      <Typography variant="pi">
                        {new Date(sub.createdAt).toLocaleString()}
                      </Typography>
                    </Td>
                    <Td>
                      <Typography>
                        {Object.entries(sub.data ?? {})
                          .slice(0, 2)
                          .map(([id, v]) => `${labelByFieldId.get(id) ?? id}: ${stringify(v)}`)
                          .join(' · ')}
                      </Typography>
                    </Td>
                    <Td>
                      <Badge>{sub.status}</Badge>
                    </Td>
                    <Td>
                      <Flex gap={2}>
                        <Button variant="tertiary" size="S" onClick={() => setOpenSubmission(sub)}>
                          View
                        </Button>
                        {sub.status !== 'read' && (
                          <Button variant="tertiary" size="S" onClick={() => onSetStatus(sub, 'read')}>
                            Mark read
                          </Button>
                        )}
                        {sub.status !== 'spam' && (
                          <Button variant="tertiary" size="S" onClick={() => onSetStatus(sub, 'spam')}>
                            Mark spam
                          </Button>
                        )}
                        <Button
                          variant="danger-light"
                          size="S"
                          startIcon={<Trash />}
                          onClick={() => onDelete(sub)}
                        >
                          Delete
                        </Button>
                      </Flex>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
        </Box>

        {openSubmission && (
          <SubmissionDetailModal
            submission={openSubmission}
            labelByFieldId={labelByFieldId}
            onClose={() => setOpenSubmission(null)}
            onSetStatus={async (status) => {
              await onSetStatus(openSubmission, status);
              setOpenSubmission(null);
            }}
            onDelete={async () => {
              await onDelete(openSubmission);
              setOpenSubmission(null);
            }}
          />
        )}
      </Box>
    </Main>
  );
};

const stringify = (v: unknown): string => {
  if (v === undefined || v === null) return '';
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

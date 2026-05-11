import { useState } from 'react';
import styled from 'styled-components';
import { Modal, Button, Typography, IconButton, Box } from '@strapi/design-system';
import { Trash, Duplicate, Check } from '@strapi/icons';

type Submission = {
  id: number;
  documentId: string;
  data: Record<string, unknown>;
  status: 'submitted' | 'read' | 'spam';
  metadata?: Record<string, unknown>;
  createdAt: string;
};

type Props = {
  submission: Submission;
  labelByFieldId: Map<string, string>;
  onClose: () => void;
  onSetStatus: (status: 'submitted' | 'read' | 'spam') => Promise<void>;
  onDelete: () => Promise<void>;
};

const stringify = (v: unknown): string => {
  if (v === undefined || v === null) return '';
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

const isCopyable = (v: unknown) =>
  typeof v === 'string' && v.length > 0 && (v.includes('@') || v.length > 20 || /^\+?\d/.test(v));

const TopBar = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
`;

const StatusPill = styled.span<{ $tone: 'submitted' | 'read' | 'spam' }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  background: ${({ $tone }) =>
    $tone === 'submitted' ? '#e9eaff' : $tone === 'read' ? '#e6f7ed' : '#fdf4dc'};
  color: ${({ $tone }) =>
    $tone === 'submitted' ? '#4945ff' : $tone === 'read' ? '#18794e' : '#a78a07'};
`;

const StatusDot = styled.span<{ $tone: 'submitted' | 'read' | 'spam' }>`
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: ${({ $tone }) =>
    $tone === 'submitted' ? '#4945ff' : $tone === 'read' ? '#18794e' : '#a78a07'};
`;

const SectionLabel = styled.div`
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: ${({ theme }) => theme?.colors?.neutral500 ?? '#8e8ea9'};
  margin-bottom: 8px;
`;

const DefList = styled.div`
  display: grid;
  grid-template-columns: 160px 1fr;
  border: 1px solid ${({ theme }) => theme?.colors?.neutral200 ?? '#dcdce4'};
  border-radius: 8px;
  overflow: hidden;
  background: ${({ theme }) => theme?.colors?.neutral0 ?? '#fff'};
`;

const DtCell = styled.div`
  padding: 12px 14px;
  background: ${({ theme }) => theme?.colors?.neutral100 ?? '#f6f6f9'};
  border-bottom: 1px solid ${({ theme }) => theme?.colors?.neutral200 ?? '#dcdce4'};
  font-size: 0.8125rem;
  font-weight: 600;
  color: ${({ theme }) => theme?.colors?.neutral700 ?? '#4a4a6a'};
  display: flex;
  align-items: flex-start;

  &:last-of-type {
    border-bottom: none;
  }
`;

const DdCell = styled.div`
  padding: 12px 14px;
  border-bottom: 1px solid ${({ theme }) => theme?.colors?.neutral200 ?? '#dcdce4'};
  font-size: 0.875rem;
  color: ${({ theme }) => theme?.colors?.neutral800 ?? '#32324d'};
  word-break: break-word;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;

  &:last-of-type {
    border-bottom: none;
  }
`;

const ValueText = styled.span`
  flex: 1;
  white-space: pre-wrap;
`;

const Empty = styled.span`
  color: ${({ theme }) => theme?.colors?.neutral400 ?? '#a5a5ba'};
  font-style: italic;
`;

const Section = styled.div`
  margin-bottom: 20px;

  &:last-child {
    margin-bottom: 0;
  }
`;

const FooterLeft = styled.div`
  display: flex;
  gap: 8px;
  flex: 1;
`;

const formatDate = (s: string): string => {
  try {
    const d = new Date(s);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return s;
  }
};

/**
 * Heuristic User-Agent parser. Good enough to render "Chrome 147 on macOS" without
 * pulling in a 30KB UA library. Falls back to the raw string if it doesn't match.
 */
const parseUserAgent = (ua: string): string => {
  if (!ua) return '';
  let browser = 'Unknown browser';
  const browserMatchers: Array<[RegExp, string]> = [
    [/Edg\/(\d+)/, 'Edge'],
    [/OPR\/(\d+)/, 'Opera'],
    [/Firefox\/(\d+)/, 'Firefox'],
    [/Chrome\/(\d+)/, 'Chrome'],
    [/Version\/(\d+).*Safari/, 'Safari'],
  ];
  for (const [re, name] of browserMatchers) {
    const m = ua.match(re);
    if (m) {
      browser = `${name} ${m[1]}`;
      break;
    }
  }
  let os = '';
  if (/Mac OS X|Macintosh/.test(ua)) os = 'macOS';
  else if (/Windows/.test(ua)) os = 'Windows';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/iPhone|iPad/.test(ua)) os = 'iOS';
  else if (/Linux/.test(ua)) os = 'Linux';
  return os ? `${browser} on ${os}` : browser;
};

const CopyButton = ({ value }: { value: string }) => {
  const [copied, setCopied] = useState(false);
  return (
    <IconButton
      variant="ghost"
      label={copied ? 'Copied!' : 'Copy'}
      withTooltip
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {
          // Clipboard may be blocked; ignore.
        }
      }}
    >
      {copied ? <Check /> : <Duplicate />}
    </IconButton>
  );
};

const Row = ({ label, value }: { label: string; value: unknown }) => {
  const stringValue = stringify(value);
  return (
    <>
      <DtCell>{label}</DtCell>
      <DdCell>
        {stringValue === '' ? (
          <Empty>(empty)</Empty>
        ) : (
          <ValueText>{stringValue}</ValueText>
        )}
        {isCopyable(value) && stringValue !== '' && <CopyButton value={stringValue} />}
      </DdCell>
    </>
  );
};

export const SubmissionDetailModal = ({
  submission,
  labelByFieldId,
  onClose,
  onSetStatus,
  onDelete,
}: Props) => {
  const meta = (submission.metadata ?? {}) as Record<string, any>;
  const dataEntries = Object.entries(submission.data ?? {});

  return (
    <Modal.Root open onOpenChange={(o: boolean) => !o && onClose()}>
      <Modal.Content style={{ maxWidth: '720px' }}>
        <Modal.Header>
          <Modal.Title>Submission</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Section>
            <TopBar>
              <Typography variant="omega" textColor="neutral600">
                {formatDate(submission.createdAt)}
              </Typography>
              <StatusPill $tone={submission.status}>
                <StatusDot $tone={submission.status} />
                {submission.status === 'submitted'
                  ? 'New'
                  : submission.status === 'read'
                    ? 'Read'
                    : 'Spam'}
              </StatusPill>
            </TopBar>
          </Section>

          <Section>
            <SectionLabel>Form data</SectionLabel>
            {dataEntries.length === 0 ? (
              <Box padding={3} background="neutral100" hasRadius>
                <Typography textColor="neutral600">
                  No data — likely a honeypot-triggered submission.
                </Typography>
              </Box>
            ) : (
              <DefList>
                {dataEntries.map(([id, v]) => (
                  <Row key={id} label={labelByFieldId.get(id) ?? id} value={v} />
                ))}
              </DefList>
            )}
          </Section>

          {meta && Object.keys(meta).length > 0 && (
            <Section>
              <SectionLabel>Metadata</SectionLabel>
              <DefList>
                {meta.ip && <Row label="IP address" value={meta.ip} />}
                {meta.userAgent && (
                  <Row label="Browser" value={parseUserAgent(String(meta.userAgent))} />
                )}
                {meta.referrer && <Row label="Referrer" value={meta.referrer} />}
                {meta.submittedAt && (
                  <Row label="Submitted at" value={formatDate(String(meta.submittedAt))} />
                )}
                {meta.formSchemaVersion !== undefined && (
                  <Row label="Schema version" value={`v${meta.formSchemaVersion}`} />
                )}
                {meta.honeypot && <Row label="Honeypot" value="Triggered" />}
              </DefList>
            </Section>
          )}
        </Modal.Body>
        <Modal.Footer>
          <FooterLeft>
            <Button variant="tertiary" onClick={onClose}>
              Close
            </Button>
            <Button
              variant="danger-light"
              startIcon={<Trash />}
              onClick={async () => {
                if (!window.confirm('Delete this submission?')) return;
                await onDelete();
              }}
            >
              Delete
            </Button>
          </FooterLeft>
          {submission.status !== 'spam' && (
            <Button variant="secondary" onClick={() => onSetStatus('spam')}>
              Mark as spam
            </Button>
          )}
          {submission.status !== 'read' && (
            <Button startIcon={<Check />} onClick={() => onSetStatus('read')}>
              Mark as read
            </Button>
          )}
          {submission.status === 'read' && (
            <Button variant="tertiary" onClick={() => onSetStatus('submitted')}>
              Mark as new
            </Button>
          )}
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  );
};

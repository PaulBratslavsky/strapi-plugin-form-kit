/**
 * Chat surface for the AI form builder.
 *
 * Two modes:
 *   - "generate" (no current schema): the primary creation path from
 *     /plugins/forms/forms/new. User describes the form they want, AI
 *     produces a draft schema, parent opens it in the visual builder.
 *   - "refine" (current schema present): docked inside the form builder
 *     as a side panel. User types an instruction, AI returns a modified
 *     schema, parent applies it (optionally with a diff confirmation).
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { Box, Typography, Button } from '@strapi/design-system';
import { useFormsApi } from '../../api';

type Mode = 'generate' | 'refine';

type DraftField = { type: string; label: string; name?: string };

type ChatMessage =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text: string; schema?: any; error?: string };

/**
 * Walks the streaming JSON buffer and pulls out complete field objects inside
 * the top-level `fields` array. Used to render live "field cards" while the
 * model streams — no need to wait for the whole response. Ignores any partial
 * trailing object (it'll appear next chunk). Resilient to key ordering and
 * unrelated top-level keys.
 */
const extractCompleteFields = (buffer: string): DraftField[] => {
  const startIdx = buffer.indexOf('"fields"');
  if (startIdx === -1) return [];
  const arrStart = buffer.indexOf('[', startIdx);
  if (arrStart === -1) return [];

  const out: DraftField[] = [];
  let i = arrStart + 1;
  while (i < buffer.length) {
    while (i < buffer.length && /[\s,]/.test(buffer[i] ?? '')) i++;
    if (i >= buffer.length || buffer[i] === ']') break;
    if (buffer[i] !== '{') break;

    const objStart = i;
    let depth = 0;
    let inStr = false;
    let escape = false;
    for (; i < buffer.length; i++) {
      const c = buffer[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (c === '\\' && inStr) {
        escape = true;
        continue;
      }
      if (c === '"') inStr = !inStr;
      else if (!inStr && c === '{') depth++;
      else if (!inStr && c === '}') {
        depth--;
        if (depth === 0) {
          i++;
          break;
        }
      }
    }
    if (depth !== 0) break; // object not yet complete — try again next chunk

    try {
      const obj = JSON.parse(buffer.slice(objStart, i));
      const type = String(obj.type ?? 'text');
      const label = String(obj.label ?? obj.name ?? '').trim();
      out.push({
        type,
        label: label || titleCaseFromName(obj.name) || `Field ${out.length + 1}`,
        name: obj.name ? String(obj.name) : undefined,
      });
    } catch {
      /* malformed — skip */
    }
  }
  return out;
};

const titleCaseFromName = (n: unknown): string => {
  if (typeof n !== 'string') return '';
  return n
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
};

// Per-type single-char glyphs for the streaming preview cards. Kept text
// (not @strapi/icons) for compactness and so they line up in a tight list.
const TYPE_GLYPH: Record<string, string> = {
  text: 'Aa',
  textarea: '¶',
  email: '@',
  number: '#',
  phone: '☎',
  url: '↗',
  dropdown: '▼',
  radio: '◉',
  checkboxes: '☑',
  date: '◷',
  hidden: '·',
  content: 'ℹ',
};

type Props = {
  mode: Mode;
  /**
   * Which side of the form the chat targets. 'layout' = field schema,
   * 'style' = theme/styling. Picked by the parent based on the current
   * Build/Style view.
   */
  target?: 'layout' | 'style';
  currentSchema?: any;
  currentTheme?: any;
  onSchemaReady?: (schema: any) => void;
  onThemeReady?: (theme: any) => void;
  placeholder?: string;
};

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
`;

const Header = styled.div`
  padding: 14px 16px;
  border-bottom: 1px solid ${({ theme }) => theme?.colors?.neutral200 ?? '#dcdce4'};
`;

const Messages = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const Bubble = styled.div<{ $role: 'user' | 'assistant'; $isError?: boolean }>`
  align-self: ${({ $role }) => ($role === 'user' ? 'flex-end' : 'flex-start')};
  max-width: 92%;
  padding: 12px 14px;
  border-radius: 12px;
  font-size: 0.9375rem;
  line-height: 1.5;
  background: ${({ $role, $isError, theme }) =>
    $isError
      ? theme?.colors?.danger100 ?? '#fcecea'
      : $role === 'user'
        ? theme?.colors?.primary600 ?? '#4945ff'
        : theme?.colors?.neutral100 ?? '#f6f6f9'};
  color: ${({ $role, $isError, theme }) =>
    $isError
      ? theme?.colors?.danger700 ?? '#a82215'
      : $role === 'user'
        ? '#fff'
        : theme?.colors?.neutral800 ?? '#32324d'};
  white-space: pre-wrap;
`;

const Composer = styled.form`
  padding: 12px 16px;
  border-top: 1px solid ${({ theme }) => theme?.colors?.neutral200 ?? '#dcdce4'};
  display: flex;
  gap: 8px;
  align-items: flex-end;
`;

const Textarea = styled.textarea`
  flex: 1;
  resize: none;
  min-height: 80px;
  max-height: 220px;
  padding: 10px 12px;
  border: 1px solid ${({ theme }) => theme?.colors?.neutral200 ?? '#dcdce4'};
  border-radius: 6px;
  font: inherit;
  font-size: 0.9375rem;
  line-height: 1.4;

  &:focus {
    outline: 2px solid ${({ theme }) => theme?.colors?.primary600 ?? '#4945ff'};
    outline-offset: -1px;
    border-color: ${({ theme }) => theme?.colors?.primary600 ?? '#4945ff'};
  }
`;

const Suggestions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
`;

const Chip = styled.button`
  border: 1px solid ${({ theme }) => theme?.colors?.neutral200 ?? '#dcdce4'};
  background: ${({ theme }) => theme?.colors?.neutral0 ?? '#fff'};
  color: ${({ theme }) => theme?.colors?.neutral700 ?? '#4a4a6a'};
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 0.8125rem;
  cursor: pointer;

  &:hover {
    border-color: ${({ theme }) => theme?.colors?.primary600 ?? '#4945ff'};
    color: ${({ theme }) => theme?.colors?.primary600 ?? '#4945ff'};
  }
`;

const DraftHeader = styled.div`
  font-weight: 600;
  margin-bottom: 8px;
  font-size: 0.875rem;
  color: ${({ theme }) => theme?.colors?.neutral700 ?? '#4a4a6a'};
`;

const DraftCardList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const DraftCard = styled.div<{ $pulse?: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: ${({ theme }) => theme?.colors?.neutral0 ?? '#fff'};
  border: 1px solid ${({ theme }) => theme?.colors?.neutral200 ?? '#dcdce4'};
  border-radius: 8px;
  font-size: 0.875rem;
  animation: ${({ $pulse }) => ($pulse ? 'sfPulse 1.4s ease-in-out infinite' : 'none')};

  @keyframes sfPulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.55; }
  }
`;

const DraftGlyph = styled.div`
  width: 26px;
  height: 26px;
  border-radius: 6px;
  background: ${({ theme }) => theme?.colors?.primary100 ?? '#f0f0ff'};
  color: ${({ theme }) => theme?.colors?.primary600 ?? '#4945ff'};
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 0.8125rem;
  flex-shrink: 0;
`;

const DraftLabel = styled.div`
  flex: 1;
  font-weight: 500;
  color: ${({ theme }) => theme?.colors?.neutral800 ?? '#32324d'};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const DraftType = styled.div`
  font-size: 0.75rem;
  color: ${({ theme }) => theme?.colors?.neutral600 ?? '#666687'};
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
`;

const DraftFooter = styled.div`
  margin-top: 8px;
  font-size: 0.75rem;
  color: ${({ theme }) => theme?.colors?.neutral500 ?? '#8e8ea9'};
`;

const GENERATE_SUGGESTIONS = [
  'Contact form: name, email, message.',
  'Lead-gen: name, email, company, role dropdown.',
  'Event RSVP: name, email, attending yes/no, dietary needs.',
  'Bug report: title, severity, steps to reproduce.',
];

const REFINE_SUGGESTIONS = [
  'Add a phone field after email.',
  'Make the company field required.',
  'Add a budget dropdown with 4 ranges.',
  'Remove the message field.',
];

const STYLE_SUGGESTIONS = [
  'Make it dark mode.',
  'Style it like a Stripe payment form.',
  'Newspapery / editorial vibe.',
  'More friendly — rounder corners, warmer colors.',
  'Brutalist: mono font, sharp edges, no shadow.',
  'Surprise me — be creative.',
];

export const AiBuilderPanel = ({
  mode,
  target = 'layout',
  currentSchema,
  currentTheme,
  onSchemaReady,
  onThemeReady,
  placeholder,
}: Props) => {
  const navigate = useNavigate();
  const { aiStream, aiHealth } = useFormsApi();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [draftFields, setDraftFields] = useState<DraftField[]>([]);
  const [healthError, setHealthError] = useState<string | null>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    aiHealth()
      .then((r) => {
        if (!r.ok) setHealthError(r.error ?? 'AI provider is not configured.');
      })
      .catch((err) => setHealthError(err?.message ?? 'AI provider is not reachable.'));
  }, [aiHealth]);

  useEffect(() => {
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  // Auto-scroll while tokens stream in.
  useEffect(() => {
    if (streamingText) {
      messagesRef.current?.scrollTo({
        top: messagesRef.current.scrollHeight,
        behavior: 'auto',
      });
    }
  }, [streamingText]);

  const submit = (text: string) => {
    const cleaned = text.trim();
    if (!cleaned || sending) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text: cleaned }]);
    setSending(true);
    setStreamingText('');
    setDraftFields([]);

    abortRef.current = aiStream(
      {
        target,
        mode,
        prompt: cleaned,
        currentSchema: target === 'layout' && mode === 'refine' ? currentSchema : undefined,
        currentTheme: target === 'style' ? currentTheme : undefined,
      },
      {
        onChunk: (delta) => {
          setStreamingText((prev) => {
            const next = prev + delta;
            // Re-extract on each chunk — cheap; runs only while the drawer
            // is open and a stream is active.
            const detected = extractCompleteFields(next);
            setDraftFields((old) =>
              detected.length !== old.length ? detected : old
            );
            return next;
          });
        },
        onDone: (result) => {
          if (result.target === 'style') {
            const theme = result.theme;
            const summarised = Object.entries(theme)
              .filter(([, v]) => v !== undefined)
              .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
              .join('\n');
            const summary =
              Object.keys(theme).length > 0
                ? `Applied style changes:\n${summarised}`
                : 'No style changes (returned an empty diff).';
            setMessages((m) => [...m, { role: 'assistant', text: summary }]);
            onThemeReady?.(theme);
          } else {
            const schema = result.schema;
            const fields = (schema?.fields ?? []) as Array<{ type: string; label: string }>;
            const fieldList = fields
              .map((f, i) => `${i + 1}. ${f.label}  ·  ${f.type}`)
              .join('\n');
            const header =
              mode === 'generate'
                ? `Built a form with ${fields.length} field${fields.length === 1 ? '' : 's'}:`
                : `Updated the form — now ${fields.length} field${fields.length === 1 ? '' : 's'}:`;
            const summary = fields.length > 0 ? `${header}\n${fieldList}` : header;
            setMessages((m) => [...m, { role: 'assistant', text: summary, schema }]);
            onSchemaReady?.(schema);
          }
          setStreamingText('');
          setDraftFields([]);
          setSending(false);
        },
        onError: (msg) => {
          setMessages((m) => [...m, { role: 'assistant', text: msg, error: msg }]);
          setStreamingText('');
          setDraftFields([]);
          setSending(false);
        },
      }
    );
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void submit(input);
  };

  if (healthError) {
    return (
      <Wrap>
        <Header>
          <Typography variant="beta" tag="div">
            AI builder
          </Typography>
        </Header>
        <Box padding={4}>
          <Box padding={3} background="warning100" hasRadius>
            <Typography textColor="warning600" tag="div" fontWeight="bold">
              AI is not configured
            </Typography>
            <Box marginTop={1}>
              <Typography variant="pi" textColor="warning600">
                {healthError}
              </Typography>
            </Box>
            <Box marginTop={2}>
              <Typography variant="pi">
                Choose a provider and add an API key to get started.
              </Typography>
            </Box>
            <Box marginTop={3}>
              <Button onClick={() => navigate('/settings/forms/ai-builder')}>
                Open AI settings
              </Button>
            </Box>
          </Box>
        </Box>
      </Wrap>
    );
  }

  const suggestions =
    target === 'style'
      ? STYLE_SUGGESTIONS
      : mode === 'generate'
        ? GENERATE_SUGGESTIONS
        : REFINE_SUGGESTIONS;

  return (
    <Wrap>
      <Header>
        <Typography variant="beta" tag="div">
          {target === 'style'
            ? 'Style with AI'
            : mode === 'generate'
              ? 'Describe your form'
              : 'Refine with AI'}
        </Typography>
        <Box marginTop={1}>
          <Typography variant="pi" textColor="neutral600">
            {target === 'style'
              ? 'Describe the look you want and AI will apply it to the form.'
              : mode === 'generate'
                ? 'Tell the AI what fields you need. It drafts a schema you can then edit visually.'
                : 'Type an instruction and the AI will modify the current form.'}
          </Typography>
        </Box>
      </Header>

      <Messages ref={messagesRef}>
        {messages.length === 0 && (
          <Box padding={2}>
            <Typography variant="pi" textColor="neutral600" tag="div">
              Try one of these to start:
            </Typography>
            <Suggestions>
              {suggestions.map((s) => (
                <Chip key={s} type="button" onClick={() => void submit(s)}>
                  {s}
                </Chip>
              ))}
            </Suggestions>
          </Box>
        )}
        {messages.map((m, i) => (
          <Bubble key={i} $role={m.role} $isError={m.role === 'assistant' && !!m.error}>
            {m.text}
          </Bubble>
        ))}
        {sending && (
          <Bubble $role="assistant">
            {draftFields.length > 0 ? (
              <>
                <DraftHeader>
                  {mode === 'generate' ? 'Building your form…' : 'Applying changes…'}
                </DraftHeader>
                <DraftCardList>
                  {draftFields.map((f, i) => (
                    <DraftCard key={`${i}-${f.label}`}>
                      <DraftGlyph>{TYPE_GLYPH[f.type] ?? '?'}</DraftGlyph>
                      <DraftLabel>{f.label}</DraftLabel>
                      <DraftType>{f.type}</DraftType>
                    </DraftCard>
                  ))}
                  <DraftCard $pulse>
                    <DraftGlyph>…</DraftGlyph>
                    <DraftLabel style={{ fontStyle: 'italic', opacity: 0.75 }}>
                      drafting next field
                    </DraftLabel>
                  </DraftCard>
                </DraftCardList>
                {streamingText && (
                  <DraftFooter>{streamingText.length.toLocaleString()} chars streamed</DraftFooter>
                )}
              </>
            ) : streamingText ? (
              <span style={{ opacity: 0.7 }}>
                Reading model response…
                <DraftFooter style={{ marginTop: 4 }}>
                  {streamingText.length.toLocaleString()} chars streamed
                </DraftFooter>
              </span>
            ) : (
              <span style={{ opacity: 0.7 }}>
                {mode === 'generate' ? 'Asking the model…' : 'Sending your refinement…'}
              </span>
            )}
          </Bubble>
        )}
      </Messages>

      <Composer onSubmit={onSubmit}>
        <Textarea
          value={input}
          placeholder={
            placeholder ??
            (mode === 'generate'
              ? 'e.g. "A contact form for an architecture firm with name, email, and project type"'
              : 'e.g. "Add a phone field after email"')
          }
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void submit(input);
            }
          }}
          disabled={sending}
        />
        <Button type="submit" disabled={!input.trim() || sending} loading={sending}>
          Send
        </Button>
      </Composer>
    </Wrap>
  );
};

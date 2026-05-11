/**
 * The Share/Embed panel shown in the FormBuilder's "Embed" tab.
 *
 * Three deploy flavours — all powered by the plugin itself (no npm/CDN
 * required):
 *   1. Script snippet:    <div data-strapi-form="slug"></div>
 *                         <script src="<origin>/api/forms/embed.js"></script>
 *   2. Iframe:            <iframe src="<origin>/api/forms/slug/embed">
 *   3. Direct link:       <origin>/api/forms/slug/embed
 *
 * The host site only needs the snippet — the embed script auto-detects the
 * Strapi origin from `document.currentScript.src`, and the iframe/hosted
 * page route renders a complete standalone HTML document.
 */
import { Box, Typography, Button, Flex } from '@strapi/design-system';
import { useState } from 'react';
import styled from 'styled-components';

type Props = {
  slug: string;
  /** The form's documentId — used as the rename-safe lookup key when "stable ID" is toggled on. */
  documentId?: string;
  baseUrl?: string;
};

type Flavour = 'script' | 'iframe' | 'link';

const SnippetBox = styled.pre`
  margin: 0;
  padding: 12px;
  background: ${({ theme }) => theme?.colors?.neutral150 ?? '#f0f0f4'};
  border: 1px solid ${({ theme }) => theme?.colors?.neutral200 ?? '#dcdce4'};
  border-radius: 6px;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
`;

const FlavourTabs = styled.div`
  display: flex;
  gap: 4px;
  margin-bottom: 12px;
  border-bottom: 1px solid ${({ theme }) => theme?.colors?.neutral200 ?? '#dcdce4'};
`;

const FlavourTab = styled.button<{ $active: boolean }>`
  background: transparent;
  border: none;
  padding: 8px 12px;
  font-size: 0.875rem;
  font-weight: ${({ $active }) => ($active ? 600 : 400)};
  color: ${({ $active, theme }) =>
    $active ? theme?.colors?.primary600 ?? '#4945ff' : theme?.colors?.neutral600 ?? '#666687'};
  border-bottom: 2px solid
    ${({ $active, theme }) => ($active ? theme?.colors?.primary600 ?? '#4945ff' : 'transparent')};
  margin-bottom: -1px;
  cursor: pointer;
`;

/**
 * Snippet shapes — script/iframe use the *documentId* so the embed never
 * breaks if someone renames the slug later. The direct link uses the slug
 * because that URL is meant for human eyes (email/Slack/socials), and the
 * public route accepts either form via the lookup helper anyway.
 */
const buildSnippets = (slug: string, documentId: string, origin: string) => {
  const stableKey = documentId || slug;
  return {
    script:
      `<div data-strapi-form="${stableKey}"></div>\n` +
      `<script src="${origin}/api/forms/embed.js"></script>`,
    iframe:
      `<iframe src="${origin}/api/forms/${stableKey}/embed"\n` +
      `        style="border:0;width:100%;min-height:600px"\n` +
      `        title="Form"></iframe>`,
    link: `${origin}/api/forms/${slug}/embed`,
  };
};

const DESCRIPTIONS: Record<Flavour, string> = {
  script:
    'Drop on any HTML page. Auto-detects this Strapi instance as the origin. Targets the form by stable ID — survives slug renames.',
  iframe:
    'Self-contained iframe. Best for no-code sites (Webflow, WordPress, Notion) and full CSS isolation. Targets the form by stable ID.',
  link:
    'Human-readable hosted page. Slug-based so the URL is shareable; renaming the form changes this URL.',
};

export const EmbedCodeSnippet = ({ slug, documentId, baseUrl }: Props) => {
  const origin = baseUrl ?? (typeof window !== 'undefined' ? window.location.origin : '');
  const [flavour, setFlavour] = useState<Flavour>('script');
  const [copied, setCopied] = useState(false);

  const snippets = buildSnippets(slug, documentId ?? '', origin);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippets[flavour]);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may be blocked; user can select & copy manually.
    }
  };

  return (
    <Box>
      <Typography variant="pi" fontWeight="bold" textColor="neutral700">
        Share / embed
      </Typography>
      <Box marginTop={2}>
        <Typography variant="pi" textColor="neutral600">
          {DESCRIPTIONS[flavour]}
        </Typography>
      </Box>

      <Box marginTop={3}>
        <FlavourTabs>
          <FlavourTab $active={flavour === 'script'} onClick={() => setFlavour('script')}>
            Script
          </FlavourTab>
          <FlavourTab $active={flavour === 'iframe'} onClick={() => setFlavour('iframe')}>
            Iframe
          </FlavourTab>
          <FlavourTab $active={flavour === 'link'} onClick={() => setFlavour('link')}>
            Direct link
          </FlavourTab>
        </FlavourTabs>

        <SnippetBox>{snippets[flavour]}</SnippetBox>

        <Box marginTop={2}>
          <Flex gap={2} alignItems="center">
            <Button variant="secondary" size="S" onClick={copy}>
              {copied ? 'Copied!' : 'Copy'}
            </Button>
            {flavour === 'link' && (
              <Button
                variant="tertiary"
                size="S"
                onClick={() => window.open(snippets.link, '_blank', 'noopener')}
              >
                Open in new tab
              </Button>
            )}
          </Flex>
        </Box>
      </Box>
    </Box>
  );
};

/**
 * Lazy-loaded CodeMirror 6 HTML editor used for the `content` field type.
 * Wrapped in React.lazy so CodeMirror only loads when a content field is
 * actually being edited — keeps the admin bundle small for everyone else.
 */
import { lazy, Suspense } from 'react';
import styled from 'styled-components';

const InnerEditor = lazy(() => import('./HtmlEditorInner'));

const Skeleton = styled.div`
  height: 140px;
  border: 1px solid ${({ theme }) => theme?.colors?.neutral200 ?? '#dcdce4'};
  border-radius: 6px;
  background: ${({ theme }) => theme?.colors?.neutral100 ?? '#f6f6f9'};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
  color: ${({ theme }) => theme?.colors?.neutral500 ?? '#8e8ea9'};
`;

type Props = {
  value: string;
  onChange: (next: string) => void;
};

export const HtmlEditor = (props: Props) => (
  <Suspense fallback={<Skeleton>Loading editor…</Skeleton>}>
    <InnerEditor {...props} />
  </Suspense>
);

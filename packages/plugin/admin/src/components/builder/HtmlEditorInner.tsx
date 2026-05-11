import styled from 'styled-components';
import CodeMirror from '@uiw/react-codemirror';
import { html } from '@codemirror/lang-html';

const Frame = styled.div`
  border: 1px solid ${({ theme }) => theme?.colors?.neutral200 ?? '#dcdce4'};
  border-radius: 6px;
  overflow: hidden;
  background: ${({ theme }) => theme?.colors?.neutral0 ?? '#fff'};

  & .cm-editor {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.8125rem;
  }
  & .cm-focused {
    outline: 2px solid ${({ theme }) => theme?.colors?.primary600 ?? '#4945ff'};
    outline-offset: -1px;
  }
`;

type Props = {
  value: string;
  onChange: (next: string) => void;
};

const InnerEditor = ({ value, onChange }: Props) => {
  return (
    <Frame>
      <CodeMirror
        value={value}
        height="180px"
        extensions={[html()]}
        basicSetup={{
          lineNumbers: false,
          foldGutter: false,
          highlightActiveLine: false,
          highlightActiveLineGutter: false,
          dropCursor: false,
        }}
        onChange={(next) => onChange(next)}
      />
    </Frame>
  );
};

export default InnerEditor;

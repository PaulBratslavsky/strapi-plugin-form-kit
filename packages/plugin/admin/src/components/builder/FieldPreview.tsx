/**
 * Read-only WYSIWYG previews of each core field type. Rendered inside the canvas
 * so the builder shows what the form will look like, not an abstract field card.
 */
import styled from 'styled-components';
import type { Field } from '../../hooks/useFormSchema';

const FakeInput = styled.div`
  height: 36px;
  background: ${({ theme }) => theme?.colors?.neutral0 ?? '#fff'};
  border: 1px solid ${({ theme }) => theme?.colors?.neutral200 ?? '#dcdce4'};
  border-radius: 4px;
  padding: 8px 12px;
  font-size: 0.875rem;
  color: ${({ theme }) => theme?.colors?.neutral500 ?? '#8e8ea9'};
  display: flex;
  align-items: center;
  pointer-events: none;
`;

const FakeTextarea = styled(FakeInput)`
  min-height: 84px;
  align-items: flex-start;
  padding-top: 10px;
`;

const FakeSelect = styled(FakeInput)`
  justify-content: space-between;
  &::after {
    content: '▾';
    color: ${({ theme }) => theme?.colors?.neutral500 ?? '#8e8ea9'};
    font-size: 0.75rem;
  }
`;

const ChoiceRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.875rem;
  color: ${({ theme }) => theme?.colors?.neutral800 ?? '#32324d'};
  margin-bottom: 6px;
`;

const Box = styled.span<{ rounded?: boolean }>`
  width: 16px;
  height: 16px;
  border: 1px solid ${({ theme }) => theme?.colors?.neutral300 ?? '#c0c0cf'};
  border-radius: ${({ rounded }) => (rounded ? '50%' : '3px')};
  background: ${({ theme }) => theme?.colors?.neutral0 ?? '#fff'};
  display: inline-block;
`;

const ContentBlock = styled.div`
  background: ${({ theme }) => theme?.colors?.neutral100 ?? '#f6f6f9'};
  border: 1px dashed ${({ theme }) => theme?.colors?.neutral300 ?? '#c0c0cf'};
  border-radius: 4px;
  padding: 12px;
  font-size: 0.875rem;
  color: ${({ theme }) => theme?.colors?.neutral700 ?? '#4a4a6a'};
`;

const HiddenStub = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 4px;
  background: ${({ theme }) => theme?.colors?.neutral150 ?? '#eaeaef'};
  font-size: 0.75rem;
  color: ${({ theme }) => theme?.colors?.neutral600 ?? '#666687'};
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
`;

export const FieldPreview = ({ field }: { field: Field }) => {
  switch (field.type) {
    case 'text':
    case 'email':
    case 'phone':
    case 'url':
    case 'number':
      return <FakeInput>{(field.placeholder as string) || 'Placeholder'}</FakeInput>;
    case 'textarea':
      return <FakeTextarea>{(field.placeholder as string) || 'Placeholder'}</FakeTextarea>;
    case 'date':
      return <FakeInput>YYYY-MM-DD</FakeInput>;
    case 'dropdown':
      return <FakeSelect>{(field.placeholder as string) || 'Select…'}</FakeSelect>;
    case 'radio': {
      const opts = (field.options as Array<{ label: string; value: string }> | undefined) ?? [];
      return (
        <div>
          {opts.slice(0, 4).map((o) => (
            <ChoiceRow key={o.value}>
              <Box rounded /> {o.label}
            </ChoiceRow>
          ))}
          {opts.length > 4 && <ChoiceRow>… +{opts.length - 4} more</ChoiceRow>}
        </div>
      );
    }
    case 'checkboxes': {
      const opts = (field.options as Array<{ label: string; value: string }> | undefined) ?? [];
      return (
        <div>
          {opts.slice(0, 4).map((o) => (
            <ChoiceRow key={o.value}>
              <Box /> {o.label}
            </ChoiceRow>
          ))}
          {opts.length > 4 && <ChoiceRow>… +{opts.length - 4} more</ChoiceRow>}
        </div>
      );
    }
    case 'hidden':
      return (
        <HiddenStub>
          hidden · default = {String(field.defaultValue ?? '')}
        </HiddenStub>
      );
    case 'content':
      return (
        <ContentBlock
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: (field.html as string) || '<em>(empty content)</em>' }}
        />
      );
    default:
      return <FakeInput>Custom field: {field.type}</FakeInput>;
  }
};

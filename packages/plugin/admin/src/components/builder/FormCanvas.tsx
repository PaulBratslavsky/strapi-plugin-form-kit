import styled from 'styled-components';
import * as Popover from '@radix-ui/react-popover';
import { Typography } from '@strapi/design-system';
import { Drag, Trash, Cog, More, Feather } from '@strapi/icons';
import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Field } from '../../hooks/useFormSchema';
import { FieldPreview } from './FieldPreview';

type Props = {
  fields: Field[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
};

const isRequired = (f: Field) =>
  Array.isArray(f.validations) && f.validations.some((v: any) => v.kind === 'required');

const CanvasShell = styled.div<{ $isOver: boolean }>`
  position: relative;
  padding: 0;
  min-height: 480px;
  border-radius: 12px;
  border: 2px dashed
    ${({ $isOver, theme }) =>
      $isOver ? theme?.colors?.primary600 ?? '#4945ff' : 'transparent'};
  transition: border-color 120ms ease;
`;

const FieldCard = styled.div<{ $selected: boolean; $dragging: boolean }>`
  display: grid;
  grid-template-columns: 160px 1fr auto;
  gap: 16px;
  align-items: center;
  padding: 14px 16px 14px 20px;
  background: ${({ theme }) => theme?.colors?.neutral0 ?? '#fff'};
  border: 1px solid
    ${({ $selected, theme }) =>
      $selected ? theme?.colors?.primary600 ?? '#4945ff' : theme?.colors?.neutral200 ?? '#dcdce4'};
  border-radius: 10px;
  cursor: pointer;
  box-shadow: ${({ $selected }) =>
    $selected
      ? '0 1px 4px rgba(33, 33, 52, 0.06)'
      : '0 1px 2px rgba(33, 33, 52, 0.04)'};
  transition: border-color 120ms ease, box-shadow 120ms ease, opacity 120ms ease;
  opacity: ${({ $dragging }) => ($dragging ? 0.5 : 1)};

  &:hover {
    box-shadow: 0 2px 8px rgba(33, 33, 52, 0.08);
  }

  &:hover .sf-row-actions {
    opacity: 1;
  }

  & + & {
    margin-top: 12px;
  }
`;

const LabelText = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  word-break: break-word;
`;

const RequiredMark = styled.span`
  color: ${({ theme }) => theme?.colors?.danger600 ?? '#d02b20'};
  font-weight: 600;
`;

const Actions = styled.div<{ $alwaysVisible: boolean }>`
  display: flex;
  align-items: center;
  gap: 4px;
  opacity: ${({ $alwaysVisible }) => ($alwaysVisible ? 1 : 0)};
  transition: opacity 120ms ease;
`;

const IconBtn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  cursor: pointer;
  color: ${({ theme }) => theme?.colors?.neutral500 ?? '#8e8ea9'};
  border-radius: 6px;
  padding: 0;
  transition: background 120ms ease, color 120ms ease;

  &:hover {
    background: ${({ theme }) => theme?.colors?.neutral150 ?? '#eaeaef'};
    color: ${({ theme }) => theme?.colors?.neutral700 ?? '#4a4a6a'};
  }

  &:active {
    background: ${({ theme }) => theme?.colors?.neutral200 ?? '#dcdce4'};
  }
`;

const DragHandle = styled(IconBtn)`
  cursor: grab;
  &:active {
    cursor: grabbing;
  }
`;

const Dropdown = styled.div`
  min-width: 168px;
  background: ${({ theme }) => theme?.colors?.neutral0 ?? '#fff'};
  border: 1px solid ${({ theme }) => theme?.colors?.neutral200 ?? '#dcdce4'};
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(33, 33, 52, 0.12);
  padding: 4px;
  z-index: 10;

  &[data-state='open'] {
    animation: sf-pop-in 80ms ease-out;
  }
  @keyframes sf-pop-in {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

const DropdownItem = styled.button<{ $danger?: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 0.875rem;
  text-align: left;
  border-radius: 6px;
  color: ${({ $danger, theme }) =>
    $danger ? theme?.colors?.danger600 ?? '#d02b20' : theme?.colors?.neutral800 ?? '#32324d'};

  &:hover {
    background: ${({ $danger, theme }) =>
      $danger ? theme?.colors?.danger100 ?? '#fcecea' : theme?.colors?.neutral100 ?? '#f6f6f9'};
  }

  svg {
    width: 14px;
    height: 14px;
    color: ${({ $danger, theme }) =>
      $danger ? theme?.colors?.danger600 ?? '#d02b20' : theme?.colors?.neutral600 ?? '#666687'};
  }
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 24px;
  text-align: center;
  color: ${({ theme }) => theme?.colors?.neutral600 ?? '#666687'};
  border: 2px dashed ${({ theme }) => theme?.colors?.neutral300 ?? '#c0c0cf'};
  border-radius: 12px;
  background: ${({ theme }) => theme?.colors?.neutral0 ?? '#fff'};
`;

const EmptyIcon = styled.div`
  width: 56px;
  height: 56px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${({ theme }) => theme?.colors?.primary100 ?? '#f0f0ff'};
  color: ${({ theme }) => theme?.colors?.primary600 ?? '#4945ff'};
  margin-bottom: 12px;
`;

const ContentRow = styled.div<{ $selected: boolean; $dragging: boolean }>`
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 16px;
  align-items: start;
  padding: 14px 16px 14px 20px;
  background: ${({ theme }) => theme?.colors?.neutral0 ?? '#fff'};
  border: 1px solid
    ${({ $selected, theme }) =>
      $selected ? theme?.colors?.primary600 ?? '#4945ff' : theme?.colors?.neutral200 ?? '#dcdce4'};
  border-radius: 10px;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(33, 33, 52, 0.04);
  transition: border-color 120ms ease, box-shadow 120ms ease, opacity 120ms ease;
  opacity: ${({ $dragging }) => ($dragging ? 0.5 : 1)};

  &:hover {
    box-shadow: 0 2px 8px rgba(33, 33, 52, 0.08);
  }

  &:hover .sf-row-actions {
    opacity: 1;
  }

  & + & {
    margin-top: 12px;
  }
`;

/**
 * Radix Popover handles focus, keyboard, escape, click-outside, scroll, and
 * portaling for free. Click on the trigger is stopped from bubbling so it
 * doesn't also select the field row.
 */
const KebabMenu = ({
  onConfigure,
  onDelete,
}: {
  onConfigure: () => void;
  onDelete: () => void;
}) => (
  <Popover.Root>
    <Popover.Trigger asChild>
      <IconBtn aria-label="Field actions" onClick={(e) => e.stopPropagation()}>
        <More />
      </IconBtn>
    </Popover.Trigger>
    <Popover.Portal>
      <Popover.Content
        align="end"
        sideOffset={6}
        onClick={(e) => e.stopPropagation()}
        asChild
      >
        <Dropdown role="menu">
          <DropdownItem
            role="menuitem"
            onClick={(e) => {
              e.stopPropagation();
              onConfigure();
            }}
          >
            <Cog />
            Configure
          </DropdownItem>
          <DropdownItem
            role="menuitem"
            $danger
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash />
            Delete
          </DropdownItem>
        </Dropdown>
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>
);

const SortableField = ({
  field,
  selected,
  onSelect,
  onRemove,
}: {
  field: Field;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
    data: { source: 'canvas', fieldId: field.id },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // `content` fields are presentational — render full-width without a label column.
  if (field.type === 'content') {
    return (
      <ContentRow
        ref={setNodeRef}
        style={style}
        $selected={selected}
        $dragging={isDragging}
        onClick={onSelect}
      >
        <FieldPreview field={field} />
        <Actions
          className="sf-row-actions"
          $alwaysVisible={selected}
          onClick={(e) => e.stopPropagation()}
        >
          <DragHandle
            aria-label="Drag to reorder"
            {...listeners}
            {...attributes}
            onClick={(e) => e.stopPropagation()}
          >
            <Drag />
          </DragHandle>
          <KebabMenu onConfigure={onSelect} onDelete={onRemove} />
        </Actions>
      </ContentRow>
    );
  }

  return (
    <FieldCard
      ref={setNodeRef}
      style={style}
      $selected={selected}
      $dragging={isDragging}
      onClick={onSelect}
    >
      <LabelText>
        <Typography variant="omega" fontWeight="semiBold" textColor="neutral800">
          {field.label || '(no label)'}
        </Typography>
        {isRequired(field) && <RequiredMark aria-hidden="true">*</RequiredMark>}
      </LabelText>

      <div>
        <FieldPreview field={field} />
        {field.helpText && (
          <div style={{ marginTop: 6 }}>
            <Typography variant="pi" textColor="neutral500">
              {field.helpText as string}
            </Typography>
          </div>
        )}
      </div>

      <Actions
        className="sf-row-actions"
        $alwaysVisible={selected}
        onClick={(e) => e.stopPropagation()}
      >
        <DragHandle
          aria-label="Drag to reorder"
          {...listeners}
          {...attributes}
          onClick={(e) => e.stopPropagation()}
        >
          <Drag />
        </DragHandle>
        <KebabMenu onConfigure={onSelect} onDelete={onRemove} />
      </Actions>
    </FieldCard>
  );
};

export const FormCanvas = ({ fields, selectedId, onSelect, onRemove }: Props) => {
  const { setNodeRef, isOver } = useDroppable({ id: 'form-canvas' });

  return (
    <CanvasShell ref={setNodeRef} $isOver={isOver}>
      {fields.length === 0 ? (
        <EmptyState>
          <EmptyIcon>
            <Feather />
          </EmptyIcon>
          <Typography variant="beta">Build your form</Typography>
          <div style={{ marginTop: 4 }}>
            <Typography variant="omega" textColor="neutral600">
              Drag a field type from the left panel into this area.
            </Typography>
          </div>
        </EmptyState>
      ) : (
        <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
          {fields.map((field) => (
            <SortableField
              key={field.id}
              field={field}
              selected={selectedId === field.id}
              onSelect={() => onSelect(field.id)}
              onRemove={() => onRemove(field.id)}
            />
          ))}
        </SortableContext>
      )}
    </CanvasShell>
  );
};

import styled from 'styled-components';
import { Box, Typography } from '@strapi/design-system';
import {
  Pencil,
  Paragraph,
  Mail,
  Hashtag,
  Phone,
  Globe,
  CaretDown,
  CheckCircleEmpty,
  Check,
  Calendar,
  EyeStriked,
  Information,
  Feather,
  Drag,
} from '@strapi/icons';
import { useDraggable } from '@dnd-kit/core';
import type { ComponentType } from 'react';
import { useFieldRegistry } from '../../contexts/FieldRegistryContext';

const PALETTE_ITEM_PREFIX = 'palette:';

const ICON_BY_TYPE: Record<string, ComponentType> = {
  text: Pencil,
  textarea: Paragraph,
  email: Mail,
  number: Hashtag,
  phone: Phone,
  url: Globe,
  dropdown: CaretDown,
  radio: CheckCircleEmpty,
  checkboxes: Check,
  date: Calendar,
  hidden: EyeStriked,
  content: Information,
};

const iconFor = (type: string): ComponentType => ICON_BY_TYPE[type] ?? Feather;

const PaletteItemBox = styled.div<{ $dragging: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  background: ${({ theme }) => theme?.colors?.neutral0 ?? '#fff'};
  border: 1px solid ${({ theme }) => theme?.colors?.neutral200 ?? '#dcdce4'};
  cursor: grab;
  user-select: none;
  transition: border-color 120ms ease, background 120ms ease, box-shadow 120ms ease;
  opacity: ${({ $dragging }) => ($dragging ? 0.5 : 1)};

  &:hover {
    border-color: ${({ theme }) => theme?.colors?.primary600 ?? '#4945ff'};
    box-shadow: 0 1px 4px rgba(33, 33, 52, 0.06);
  }
`;

const IconWrap = styled.div`
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme?.colors?.primary600 ?? '#4945ff'};
  flex-shrink: 0;
`;

const PaletteLabel = styled.span`
  flex: 1;
  font-size: 0.875rem;
  font-weight: 500;
  color: ${({ theme }) => theme?.colors?.neutral800 ?? '#32324d'};
`;

const DragHandle = styled.span`
  color: ${({ theme }) => theme?.colors?.neutral500 ?? '#8e8ea9'};
  display: flex;
  align-items: center;
  flex-shrink: 0;
`;

const PaletteGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
`;

const PaletteItem = ({ name }: { name: string }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${PALETTE_ITEM_PREFIX}${name}`,
    data: { source: 'palette', fieldType: name },
  });
  const Icon = iconFor(name);

  return (
    <PaletteItemBox
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      $dragging={isDragging}
    >
      <IconWrap>
        <Icon />
      </IconWrap>
      <PaletteLabel>{labelFor(name)}</PaletteLabel>
      <DragHandle aria-hidden="true">
        <Drag />
      </DragHandle>
    </PaletteItemBox>
  );
};

export const FieldPalette = () => {
  const { fieldTypes, loading } = useFieldRegistry();

  if (loading) {
    return (
      <Box padding={4}>
        <Typography>Loading field types…</Typography>
      </Box>
    );
  }

  return (
    <Box padding={4}>
      <Typography variant="sigma" textColor="neutral600">
        Field types
      </Typography>
      <Box marginTop={1} marginBottom={4}>
        <Typography variant="pi" textColor="neutral500">
          Drag onto the canvas to add.
        </Typography>
      </Box>
      <PaletteGrid>
        {fieldTypes.map((ft) => (
          <PaletteItem key={ft.name} name={ft.name} />
        ))}
      </PaletteGrid>
    </Box>
  );
};

export const isPaletteId = (id: string) => id.startsWith(PALETTE_ITEM_PREFIX);
export const fieldTypeFromPaletteId = (id: string) => id.slice(PALETTE_ITEM_PREFIX.length);

const labelFor = (type: string): string => {
  switch (type) {
    case 'text':
      return 'Text';
    case 'textarea':
      return 'Textarea';
    case 'email':
      return 'Email';
    case 'number':
      return 'Number';
    case 'phone':
      return 'Phone';
    case 'url':
      return 'URL';
    case 'dropdown':
      return 'Dropdown';
    case 'radio':
      return 'Radio';
    case 'checkboxes':
      return 'Checkbox';
    case 'date':
      return 'Date';
    case 'hidden':
      return 'Hidden';
    case 'content':
      return 'Heading';
    default:
      return type;
  }
};

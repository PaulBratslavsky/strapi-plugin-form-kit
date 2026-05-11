/**
 * Visual that follows the cursor while a field is being dragged. Uses dnd-kit's
 * <DragOverlay> portal so it isn't constrained by the canvas/palette overflow.
 *
 * Two modes:
 *   palette → mimic a palette pill (icon + label + drag dots)
 *   canvas  → mimic the in-canvas field row at reduced size
 */
import styled from 'styled-components';
import { Typography } from '@strapi/design-system';
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
import type { ComponentType } from 'react';
import type { Field } from '../../hooks/useFormSchema';
import { FieldPreview } from './FieldPreview';

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

const PalettePill = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 8px;
  background: ${({ theme }) => theme?.colors?.neutral0 ?? '#fff'};
  border: 1px solid ${({ theme }) => theme?.colors?.primary600 ?? '#4945ff'};
  box-shadow: 0 6px 20px rgba(33, 33, 52, 0.18);
  cursor: grabbing;
  min-width: 160px;
`;

const IconWrap = styled.div`
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme?.colors?.primary600 ?? '#4945ff'};
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
`;

const CanvasRowGhost = styled.div`
  display: grid;
  grid-template-columns: 140px 1fr;
  gap: 16px;
  align-items: start;
  padding: 12px 16px;
  width: 560px;
  max-width: 70vw;
  background: ${({ theme }) => theme?.colors?.neutral0 ?? '#fff'};
  border: 1px solid ${({ theme }) => theme?.colors?.primary600 ?? '#4945ff'};
  border-radius: 8px;
  box-shadow: 0 12px 28px rgba(33, 33, 52, 0.18);
  cursor: grabbing;
`;

type Props =
  | { drag: { kind: 'palette'; fieldType: string } }
  | { drag: { kind: 'canvas'; field: Field } };

export const DragPreview = ({ drag }: Props) => {
  if (drag.kind === 'palette') {
    const Icon = iconFor(drag.fieldType);
    return (
      <PalettePill>
        <IconWrap>
          <Icon />
        </IconWrap>
        <PaletteLabel>{labelFor(drag.fieldType)}</PaletteLabel>
        <DragHandle>
          <Drag />
        </DragHandle>
      </PalettePill>
    );
  }

  const field = drag.field;
  return (
    <CanvasRowGhost>
      {field.type === 'content' ? (
        <div style={{ gridColumn: '1 / -1' }}>
          <FieldPreview field={field} />
        </div>
      ) : (
        <>
          <div style={{ paddingTop: 8 }}>
            <Typography variant="omega" fontWeight="semiBold" textColor="neutral800">
              {field.label || '(no label)'}
            </Typography>
          </div>
          <div>
            <FieldPreview field={field} />
          </div>
        </>
      )}
    </CanvasRowGhost>
  );
};

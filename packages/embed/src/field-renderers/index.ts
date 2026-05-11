import type { Field, FieldRenderer } from '../types';
import { el } from '../dom';

const isRequired = (field: Field) =>
  Array.isArray(field.validations) && field.validations.some((r) => r.kind === 'required');

const sharedAttrs = (field: Field, inputId: string) => ({
  id: inputId,
  name: field.id,
  class: 'sf-input',
  required: isRequired(field) || undefined,
  placeholder: field.placeholder,
});

export const coreRenderers: Record<string, FieldRenderer> = {
  text: ({ field, fieldEl, inputId, setValue, initialValue }) => {
    const input = el('input', {
      ...sharedAttrs(field, inputId),
      type: 'text',
      value: (initialValue as string) ?? '',
    });
    input.addEventListener('input', () => setValue(input.value));
    fieldEl.appendChild(input);
  },
  textarea: ({ field, fieldEl, inputId, setValue, initialValue }) => {
    const input = el('textarea', {
      ...sharedAttrs(field, inputId),
      rows: field.rows ?? 4,
    });
    input.value = (initialValue as string) ?? '';
    input.addEventListener('input', () => setValue(input.value));
    fieldEl.appendChild(input);
  },
  email: ({ field, fieldEl, inputId, setValue, initialValue }) => {
    const input = el('input', {
      ...sharedAttrs(field, inputId),
      type: 'email',
      autocomplete: 'email',
      value: (initialValue as string) ?? '',
    });
    input.addEventListener('input', () => setValue(input.value));
    fieldEl.appendChild(input);
  },
  number: ({ field, fieldEl, inputId, setValue, initialValue }) => {
    const input = el('input', {
      ...sharedAttrs(field, inputId),
      type: 'number',
      step: field.step ?? '',
      value: initialValue !== undefined ? String(initialValue) : '',
    });
    input.addEventListener('input', () => {
      const n = input.value === '' ? null : Number(input.value);
      setValue(n);
    });
    fieldEl.appendChild(input);
  },
  phone: ({ field, fieldEl, inputId, setValue, initialValue }) => {
    const input = el('input', {
      ...sharedAttrs(field, inputId),
      type: 'tel',
      autocomplete: 'tel',
      value: (initialValue as string) ?? '',
    });
    input.addEventListener('input', () => setValue(input.value));
    fieldEl.appendChild(input);
  },
  url: ({ field, fieldEl, inputId, setValue, initialValue }) => {
    const input = el('input', {
      ...sharedAttrs(field, inputId),
      type: 'url',
      value: (initialValue as string) ?? '',
    });
    input.addEventListener('input', () => setValue(input.value));
    fieldEl.appendChild(input);
  },
  dropdown: ({ field, fieldEl, inputId, setValue, initialValue }) => {
    const select = el('select', sharedAttrs(field, inputId));
    select.appendChild(el('option', { value: '', disabled: true, selected: !initialValue }, [field.placeholder ?? 'Select…']));
    for (const opt of field.options ?? []) {
      select.appendChild(
        el('option', { value: opt.value, selected: initialValue === opt.value }, [opt.label])
      );
    }
    select.addEventListener('change', () => setValue(select.value));
    fieldEl.appendChild(select);
  },
  radio: ({ field, fieldEl, setValue, initialValue }) => {
    const group = el('div', { class: 'sf-radio-group', role: 'radiogroup' });
    for (const opt of field.options ?? []) {
      const id = `${field.id}-${opt.value}`;
      const wrap = el('div', { class: 'sf-radio' });
      const input = el('input', {
        type: 'radio',
        id,
        name: field.id,
        value: opt.value,
        checked: initialValue === opt.value,
      });
      input.addEventListener('change', () => setValue(opt.value));
      wrap.appendChild(input);
      wrap.appendChild(el('label', { for: id }, [opt.label]));
      group.appendChild(wrap);
    }
    fieldEl.appendChild(group);
  },
  checkboxes: ({ field, fieldEl, setValue, initialValue }) => {
    const initial = Array.isArray(initialValue) ? new Set(initialValue as string[]) : new Set<string>();
    const selected = new Set<string>(initial);
    const group = el('div', { class: 'sf-checkbox-group' });
    for (const opt of field.options ?? []) {
      const id = `${field.id}-${opt.value}`;
      const wrap = el('div', { class: 'sf-checkbox' });
      const input = el('input', {
        type: 'checkbox',
        id,
        name: `${field.id}[]`,
        value: opt.value,
        checked: selected.has(opt.value),
      });
      input.addEventListener('change', () => {
        if (input.checked) selected.add(opt.value);
        else selected.delete(opt.value);
        setValue(Array.from(selected));
      });
      wrap.appendChild(input);
      wrap.appendChild(el('label', { for: id }, [opt.label]));
      group.appendChild(wrap);
    }
    fieldEl.appendChild(group);
  },
  date: ({ field, fieldEl, inputId, setValue, initialValue }) => {
    const input = el('input', {
      ...sharedAttrs(field, inputId),
      type: 'date',
      min: field.min,
      max: field.max,
      value: (initialValue as string) ?? '',
    });
    input.addEventListener('input', () => setValue(input.value));
    fieldEl.appendChild(input);
  },
  hidden: ({ field, fieldEl, inputId, setValue, initialValue }) => {
    const v = (initialValue as string) ?? (field.defaultValue as string) ?? '';
    const input = el('input', { id: inputId, name: field.id, type: 'hidden', value: v });
    fieldEl.appendChild(input);
    setValue(v);
  },
  content: ({ field, fieldEl }) => {
    const wrap = el('div', { class: 'sf-content' });
    wrap.innerHTML = field.html ?? '';
    fieldEl.appendChild(wrap);
  },
};

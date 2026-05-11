import { useCallback, useReducer } from 'react';

/**
 * Reducer for the form-being-edited. Keeps the schema valid at every edit by
 * structuring all mutations as named actions with type-checked payloads.
 *
 * The shape mirrors the canonical FormSchema (server-side) but stays untyped here
 * — server validation is the source of truth. Admin-side enforcement is best-effort.
 */

type FieldId = string;

export type FieldWidth = 'full' | 'half' | 'third' | 'two-thirds';
export type FieldSize = 'sm' | 'md' | 'lg';
export type FieldBorderWidth = 'none' | 'thin' | 'regular' | 'thick';
export type FieldPadding = 'compact' | 'normal' | 'large';

export type FieldStyle = {
  // Layout
  width?: FieldWidth;
  hideLabel?: boolean;
  labelAlign?: 'above' | 'inline';
  // Color
  accentColor?: string;
  borderColor?: string;
  inputBg?: string;
  // Border / shape
  borderWidth?: FieldBorderWidth;
  // Typography
  labelBold?: boolean;
  labelSize?: FieldSize;
  inputBold?: boolean;
  inputSize?: FieldSize;
  // Spacing
  padding?: FieldPadding;
};

export type Field = {
  id: FieldId;
  type: string;
  label: string;
  helpText?: string;
  placeholder?: string;
  defaultValue?: unknown;
  validations?: Array<Record<string, unknown>>;
  /** Per-field visual overrides applied on top of the form's theme. */
  style?: FieldStyle;
  // Type-specific knobs accepted as-is.
  [key: string]: unknown;
};

export type Settings = {
  submitButtonLabel?: string;
  successMessage?: string;
  errorMessage?: string;
  redirectUrl?: string;
  honeypotEnabled?: boolean;
  authenticatedOnly?: boolean;
  theme?: import('../components/builder/themes').ThemeConfig;
};

export type FormDraft = {
  schemaVersion: 1;
  fields: Field[];
  settings: Settings;
};

type Action =
  | { type: 'INIT'; payload: FormDraft }
  | { type: 'ADD_FIELD'; payload: { field: Field; index?: number } }
  | { type: 'REMOVE_FIELD'; payload: { id: FieldId } }
  | { type: 'REORDER_FIELDS'; payload: { fromIndex: number; toIndex: number } }
  | { type: 'UPDATE_FIELD'; payload: { id: FieldId; patch: Partial<Field> } }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<Settings> }
  | { type: 'UNDO' }
  | { type: 'REDO' };

const initialState: FormDraft = {
  schemaVersion: 1,
  fields: [],
  settings: { honeypotEnabled: true, authenticatedOnly: false },
};

/** Cap the history stack so memory stays bounded even on long sessions. */
const HISTORY_CAP = 50;

type HistoryState = {
  past: FormDraft[];
  present: FormDraft;
  future: FormDraft[];
};

const makeHistory = (present: FormDraft): HistoryState => ({
  past: [],
  present,
  future: [],
});

const applyMutation = (state: FormDraft, action: Action): FormDraft => {
  switch (action.type) {
    case 'ADD_FIELD': {
      const fields = [...state.fields];
      const idx = action.payload.index ?? fields.length;
      fields.splice(idx, 0, action.payload.field);
      return { ...state, fields };
    }
    case 'REMOVE_FIELD':
      return { ...state, fields: state.fields.filter((f) => f.id !== action.payload.id) };
    case 'REORDER_FIELDS': {
      const fields = [...state.fields];
      const [moved] = fields.splice(action.payload.fromIndex, 1);
      if (moved) fields.splice(action.payload.toIndex, 0, moved);
      return { ...state, fields };
    }
    case 'UPDATE_FIELD':
      return {
        ...state,
        fields: state.fields.map((f) =>
          f.id === action.payload.id ? { ...f, ...action.payload.patch } : f
        ),
      };
    case 'UPDATE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.payload } };
    default:
      return state;
  }
};

const reducer = (state: HistoryState, action: Action): HistoryState => {
  switch (action.type) {
    case 'INIT':
      return makeHistory(action.payload);

    case 'UNDO': {
      const last = state.past[state.past.length - 1];
      if (!last) return state;
      return {
        past: state.past.slice(0, -1),
        present: last,
        future: [state.present, ...state.future],
      };
    }
    case 'REDO': {
      const [next, ...rest] = state.future;
      if (!next) return state;
      return {
        past: [...state.past, state.present].slice(-HISTORY_CAP),
        present: next,
        future: rest,
      };
    }
    default: {
      const next = applyMutation(state.present, action);
      if (next === state.present) return state;
      return {
        past: [...state.past, state.present].slice(-HISTORY_CAP),
        present: next,
        future: [],
      };
    }
  }
};

export const useFormSchemaState = (initial?: FormDraft) => {
  const [history, dispatch] = useReducer(reducer, makeHistory(initial ?? initialState));

  return {
    state: history.present,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    init: useCallback((draft: FormDraft) => dispatch({ type: 'INIT', payload: draft }), []),
    undo: useCallback(() => dispatch({ type: 'UNDO' }), []),
    redo: useCallback(() => dispatch({ type: 'REDO' }), []),
    addField: useCallback(
      (field: Field, index?: number) => dispatch({ type: 'ADD_FIELD', payload: { field, index } }),
      []
    ),
    removeField: useCallback((id: FieldId) => dispatch({ type: 'REMOVE_FIELD', payload: { id } }), []),
    reorderFields: useCallback(
      (fromIndex: number, toIndex: number) =>
        dispatch({ type: 'REORDER_FIELDS', payload: { fromIndex, toIndex } }),
      []
    ),
    updateField: useCallback(
      (id: FieldId, patch: Partial<Field>) =>
        dispatch({ type: 'UPDATE_FIELD', payload: { id, patch } }),
      []
    ),
    updateSettings: useCallback(
      (patch: Partial<Settings>) => dispatch({ type: 'UPDATE_SETTINGS', payload: patch }),
      []
    ),
  };
};

/**
 * Default `defaultField` used when dragging a new type from the palette. Keeps the schema
 * valid (every field type must have its required type-specific properties).
 */
export const defaultField = (type: string): Field => {
  const id = (globalThis.crypto as Crypto).randomUUID();
  const base: Field = { id, type, label: defaultLabel(type), validations: [] };
  switch (type) {
    case 'textarea':
      return { ...base, rows: 4 };
    case 'dropdown':
    case 'radio':
    case 'checkboxes':
      return {
        ...base,
        options: [
          { label: 'Option 1', value: 'option-1' },
          { label: 'Option 2', value: 'option-2' },
        ],
      };
    case 'hidden':
      return { ...base, defaultValue: '' };
    case 'content':
      return { ...base, html: '<p>Section heading or instructional text</p>' };
    default:
      return base;
  }
};

const defaultLabel = (type: string): string => {
  switch (type) {
    case 'text':
      return 'Single-line text';
    case 'textarea':
      return 'Long text';
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
      return 'Choose one';
    case 'checkboxes':
      return 'Choose any';
    case 'date':
      return 'Date';
    case 'hidden':
      return 'Tracking value';
    case 'content':
      return 'Section heading';
    default:
      return type;
  }
};

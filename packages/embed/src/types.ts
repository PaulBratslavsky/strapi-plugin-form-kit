/**
 * Mirrors of the canonical FormSchema (from the plugin's Zod definitions). Kept in sync by
 * convention — the plugin's `docs/form-schema.md` is the cross-package contract.
 */

export type ValidationRule =
  | { kind: 'required'; message?: string }
  | { kind: 'minLength'; value: number; message?: string }
  | { kind: 'maxLength'; value: number; message?: string }
  | { kind: 'min'; value: number; message?: string }
  | { kind: 'max'; value: number; message?: string }
  | { kind: 'pattern'; regex: string; message?: string }
  | { kind: 'email'; message?: string }
  | { kind: 'url'; message?: string };

export type ChoiceOption = { label: string; value: string };

export type CoreFieldType =
  | 'text'
  | 'textarea'
  | 'email'
  | 'number'
  | 'phone'
  | 'url'
  | 'dropdown'
  | 'radio'
  | 'checkboxes'
  | 'date'
  | 'hidden'
  | 'content';

export type FieldStyle = {
  width?: 'full' | 'half' | 'third' | 'two-thirds';
  hideLabel?: boolean;
  labelAlign?: 'above' | 'inline';
  accentColor?: string;
  borderColor?: string;
  inputBg?: string;
  borderWidth?: 'none' | 'thin' | 'regular' | 'thick';
  labelBold?: boolean;
  labelSize?: 'sm' | 'md' | 'lg';
  inputBold?: boolean;
  inputSize?: 'sm' | 'md' | 'lg';
  padding?: 'compact' | 'normal' | 'large';
};

export type Field = {
  id: string;
  type: CoreFieldType | string;
  label: string;
  helpText?: string;
  placeholder?: string;
  defaultValue?: unknown;
  validations?: ValidationRule[];
  /** Per-field visual overrides applied on top of the form's theme. */
  style?: FieldStyle;
  // Type-specific knobs:
  rows?: number;
  options?: ChoiceOption[];
  step?: number;
  min?: string;
  max?: string;
  html?: string;
};

export type ThemeConfig = {
  preset?: 'clean' | 'editorial' | 'friendly' | 'bold';
  primaryColor?: string;
  backgroundColor?: string;
  textColor?: string;
  inputBackgroundColor?: string;
  borderRadius?: 'none' | 'sm' | 'md' | 'lg' | 'pill';
  fontFamily?: 'system' | 'sans' | 'serif' | 'mono' | string;
  fontScale?: 'sm' | 'md' | 'lg';
  labelPosition?: 'above' | 'inline';
  inputStyle?: 'outline' | 'underline' | 'filled';
  buttonStyle?: 'filled' | 'outline' | 'ghost';
  buttonWidth?: 'auto' | 'full';
  buttonAlign?: 'left' | 'center' | 'right';
  fieldSpacing?: 'compact' | 'normal' | 'relaxed';
  formWidth?: 'narrow' | 'normal' | 'wide' | 'full';
  formPadding?: 'compact' | 'normal' | 'spacious';
  shadow?: boolean;
  // Submit button fine overrides
  buttonBg?: string;
  buttonColor?: string;
  buttonBorderColor?: string;
  buttonBorderWidth?: 'none' | 'thin' | 'regular' | 'thick';
  buttonPadding?: 'compact' | 'normal' | 'large';
  buttonSize?: 'sm' | 'md' | 'lg';
  buttonBold?: boolean;
};

export type FormSettings = {
  submitButtonLabel?: string;
  successMessage?: string;
  errorMessage?: string;
  redirectUrl?: string;
  honeypotEnabled?: boolean;
  authenticatedOnly?: boolean;
  showReset?: boolean;
  resetButtonLabel?: string;
  theme?: ThemeConfig;
};

export type FormSchema = {
  schemaVersion: 1;
  fields: Field[];
  settings: FormSettings;
};

export type FetchedSchema = {
  schemaVersion: 1;
  formId: string;
  slug: string;
  schema: FormSchema;
  submissionUrl: string;
};

export type RenderFormHooks = {
  /**
   * Inspect/mutate the payload before submit. Return:
   *   - the payload object → submitted to the server (optionally augmented)
   *   - `false` → cancel the submit, no network call (used in preview mode)
   */
  beforeSubmit?: (
    data: Record<string, unknown>
  ) => Record<string, unknown> | false | Promise<Record<string, unknown> | false>;
  afterSubmit?: (result: { submissionId: string | null; successMessage: string }) => void;
  onValidationError?: (errors: Record<string, string[]>) => void;
};

export type FieldRenderer = (args: {
  field: Field;
  fieldEl: HTMLElement;
  inputId: string;
  setValue: (value: unknown) => void;
  initialValue: unknown;
}) => void;

/** Embed-fired analytics events (see resources/07-analytics.md §3). */
export type AnalyticsEventType =
  | 'view'
  | 'start'
  | 'field_change'
  | 'field_error'
  | 'submit_attempt';

export type RenderFormOptions = {
  target: HTMLElement;
  baseUrl: string;
  slug: string;
  hooks?: RenderFormHooks;
  fieldRenderers?: Record<string, FieldRenderer>;
  /** Override schema fetching for tests / custom flows. */
  preloadedSchema?: FetchedSchema;
  /**
   * Suppress analytics event reporting. Set by the admin preview so the form
   * author isn't counted, and available to hosts that want it off.
   */
  disableAnalytics?: boolean;
};

export type RenderFormHandle = {
  destroy: () => void;
};

export type ValidationErrors = Record<string, string[]>;

import {
  Box,
  Typography,
  Field,
  Toggle,
  Button,
  Flex,
  IconButton,
} from '@strapi/design-system';
import { Trash, Plus } from '@strapi/icons';
import type { Field as FieldType } from '../../hooks/useFormSchema';
import { HtmlEditor } from './HtmlEditor';

type Props = {
  field: FieldType;
  onChange: (patch: Partial<FieldType>) => void;
};

const isRequired = (field: FieldType) =>
  Array.isArray(field.validations) &&
  field.validations.some((v: any) => v.kind === 'required');

const toggleRequired = (field: FieldType): Array<Record<string, unknown>> => {
  const current = field.validations ?? [];
  if (isRequired(field)) {
    return current.filter((v: any) => v.kind !== 'required');
  }
  return [{ kind: 'required' }, ...current];
};

const FieldRow = ({
  name,
  label,
  hint,
  children,
}: {
  name: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) => (
  <Box marginBottom={4}>
    <Field.Root name={name} hint={hint}>
      <Field.Label>{label}</Field.Label>
      {children}
      {hint && <Field.Hint />}
    </Field.Root>
  </Box>
);

export const FieldConfigPanel = ({ field, onChange }: Props) => {
  const choiceField =
    field.type === 'dropdown' || field.type === 'radio' || field.type === 'checkboxes';
  const supportsValidation = field.type !== 'content' && field.type !== 'hidden';

  return (
    <Box padding={4}>
      <Box marginBottom={4}>
        <Typography variant="sigma" textColor="neutral600">
          Field configuration
        </Typography>
        <Box marginTop={1}>
          <Typography variant="pi" textColor="neutral500">
            Type: {field.type}
          </Typography>
        </Box>
      </Box>

      <FieldRow name="label" label="Label">
        <Field.Input
          value={field.label}
          onChange={(e: any) => onChange({ label: e.target.value })}
        />
      </FieldRow>

      {supportsValidation && (
        <>
          <FieldRow name="helpText" label="Help text" hint="Shown beneath the field">
            <Field.Input
              value={(field.helpText as string) ?? ''}
              onChange={(e: any) => onChange({ helpText: e.target.value })}
            />
          </FieldRow>

          <FieldRow name="placeholder" label="Placeholder">
            <Field.Input
              value={(field.placeholder as string) ?? ''}
              onChange={(e: any) => onChange({ placeholder: e.target.value })}
            />
          </FieldRow>

          <Box
            hasRadius
            padding={3}
            background="neutral100"
            borderColor="neutral200"
            marginBottom={4}
          >
            <Flex justifyContent="space-between" alignItems="center" gap={3}>
              <Box flex="1">
                <Typography variant="omega" fontWeight="bold" tag="div">
                  Required
                </Typography>
                <Box marginTop={1}>
                  <Typography variant="pi" textColor="neutral600" tag="div">
                    Reject submissions missing this field
                  </Typography>
                </Box>
              </Box>
              <Toggle
                aria-label="Required"
                checked={isRequired(field)}
                onChange={() => onChange({ validations: toggleRequired(field) })}
              />
            </Flex>
          </Box>
        </>
      )}

      {field.type === 'textarea' && (
        <FieldRow name="rows" label="Rows" hint="Visible height in lines (2–20)">
          <Field.Input
            type="number"
            min={2}
            max={20}
            value={(field.rows as number) ?? 4}
            onChange={(e: any) => {
              const n = Number(e.target.value);
              onChange({ rows: Number.isFinite(n) ? n : 4 });
            }}
          />
        </FieldRow>
      )}

      {field.type === 'hidden' && (
        <FieldRow name="defaultValue" label="Default value" hint="Sent on every submission">
          <Field.Input
            value={(field.defaultValue as string) ?? ''}
            onChange={(e: any) => onChange({ defaultValue: e.target.value })}
          />
        </FieldRow>
      )}

      {field.type === 'content' && (
        <FieldRow
          name="html"
          label="HTML"
          hint="Section heading or instructional text shown between fields"
        >
          <HtmlEditor
            value={(field.html as string) ?? ''}
            onChange={(next) => onChange({ html: next })}
          />
        </FieldRow>
      )}

      {/*
        Per-field style overrides live in Style mode, not here. Build mode
        is field semantics (type, label, validations, type-specific config);
        Style mode owns the visual layer (FieldStyleSection in StyleBuilder).
      */}

      {choiceField && (
        <Box marginTop={2}>
          <Flex justifyContent="space-between" alignItems="center" marginBottom={2}>
            <Typography variant="sigma" textColor="neutral600">
              Options
            </Typography>
            <Button
              variant="tertiary"
              size="S"
              startIcon={<Plus />}
              onClick={() => {
                const opts = (
                  (field.options as Array<{ label: string; value: string }>) ?? []
                ).slice();
                opts.push({
                  label: `Option ${opts.length + 1}`,
                  value: `option-${opts.length + 1}`,
                });
                onChange({ options: opts });
              }}
            >
              Add option
            </Button>
          </Flex>
          {((field.options as Array<{ label: string; value: string }>) ?? []).map((opt, idx) => (
            <Box
              key={idx}
              hasRadius
              padding={2}
              background="neutral100"
              borderColor="neutral200"
              marginBottom={2}
            >
              <Flex gap={2} alignItems="center">
                <Box flex="1">
                  <Field.Root name={`opt-label-${idx}`}>
                    <Field.Label>Label</Field.Label>
                    <Field.Input
                      size="S"
                      value={opt.label}
                      onChange={(e: any) => {
                        const opts = [
                          ...((field.options as Array<{ label: string; value: string }>) ?? []),
                        ];
                        opts[idx] = { ...opt, label: e.target.value };
                        onChange({ options: opts });
                      }}
                    />
                  </Field.Root>
                </Box>
                <Box flex="1">
                  <Field.Root name={`opt-value-${idx}`}>
                    <Field.Label>Value</Field.Label>
                    <Field.Input
                      size="S"
                      value={opt.value}
                      onChange={(e: any) => {
                        const opts = [
                          ...((field.options as Array<{ label: string; value: string }>) ?? []),
                        ];
                        opts[idx] = { ...opt, value: e.target.value };
                        onChange({ options: opts });
                      }}
                    />
                  </Field.Root>
                </Box>
                <IconButton
                  label="Remove option"
                  withTooltip
                  onClick={() => {
                    const opts = (
                      (field.options as Array<{ label: string; value: string }>) ?? []
                    ).filter((_, i) => i !== idx);
                    onChange({ options: opts });
                  }}
                >
                  <Trash />
                </IconButton>
              </Flex>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};

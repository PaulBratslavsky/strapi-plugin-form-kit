import { Box, Typography, Field, Toggle, Flex } from '@strapi/design-system';
import type { Settings } from '../../hooks/useFormSchema';

type Props = {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
};

const Row = ({
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

const ToggleRow = ({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}) => (
  <Box
    hasRadius
    padding={3}
    background="neutral100"
    borderColor="neutral200"
    marginBottom={3}
  >
    <Flex justifyContent="space-between" alignItems="center" gap={3}>
      <Box flex="1">
        <Typography variant="omega" fontWeight="bold" tag="div">
          {title}
        </Typography>
        <Box marginTop={1}>
          <Typography variant="pi" textColor="neutral600" tag="div">
            {description}
          </Typography>
        </Box>
      </Box>
      <Toggle
        aria-label={title}
        checked={checked}
        onChange={onChange}
      />
    </Flex>
  </Box>
);

export const FormSettingsPanel = ({ settings, onChange }: Props) => {
  return (
    <Box padding={4}>
      <Box marginBottom={4}>
        <Typography variant="sigma" textColor="neutral600">
          Form settings
        </Typography>
      </Box>

      <Row name="submitButtonLabel" label="Submit button label">
        <Field.Input
          value={settings.submitButtonLabel ?? 'Submit'}
          onChange={(e: any) => onChange({ submitButtonLabel: e.target.value })}
        />
      </Row>

      <Row name="successMessage" label="Success message">
        <Field.Input
          value={settings.successMessage ?? 'Thank you for your submission.'}
          onChange={(e: any) => onChange({ successMessage: e.target.value })}
        />
      </Row>

      <Row name="errorMessage" label="Error message">
        <Field.Input
          value={settings.errorMessage ?? 'Something went wrong. Please try again.'}
          onChange={(e: any) => onChange({ errorMessage: e.target.value })}
        />
      </Row>

      <Row
        name="redirectUrl"
        label="Redirect URL on success"
        hint="Optional. Leave blank to show the success message in place."
      >
        <Field.Input
          value={settings.redirectUrl ?? ''}
          onChange={(e: any) => onChange({ redirectUrl: e.target.value })}
        />
      </Row>

      <ToggleRow
        title="Honeypot spam protection"
        description="Adds an invisible field to silently catch bot submissions."
        checked={settings.honeypotEnabled ?? true}
        onChange={() => onChange({ honeypotEnabled: !(settings.honeypotEnabled ?? true) })}
      />

      <ToggleRow
        title="Require Strapi authentication"
        description="Block public submissions; require an authenticated user."
        checked={settings.authenticatedOnly ?? false}
        onChange={() =>
          onChange({ authenticatedOnly: !(settings.authenticatedOnly ?? false) })
        }
      />
    </Box>
  );
};

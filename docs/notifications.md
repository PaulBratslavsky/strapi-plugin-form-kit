# Email notifications

When a submission arrives, configured notification rules send an email per rule via Strapi's [email plugin](https://docs.strapi.io/cms/plugins/email).

## Configure the email provider

The plugin reuses your existing Strapi email plugin. If you haven't configured one yet, install a provider (e.g. SendGrid, Mailgun, Postmark, SMTP) and configure it in `config/plugins.ts`:

```ts
export default ({ env }) => ({
  email: {
    config: {
      provider: 'sendmail', // or 'nodemailer', 'sendgrid', 'mailgun', etc.
      providerOptions: { /* … */ },
      settings: {
        defaultFrom: 'noreply@example.com',
        defaultReplyTo: 'support@example.com',
      },
    },
  },
});
```

If no provider is configured or it fails at send time, the failure is captured in the delivery log without crashing the public submission.

## Add a rule

In the admin, open a form → **Notifications** → **Add notification rule**.

| Field | Notes |
|---|---|
| Rule name | Internal label only |
| Recipients | Comma-separated email addresses |
| Subject | Supports template placeholders (see below) |
| Body | Plain text. Supports template placeholders. |
| Enabled | Quick on/off toggle |

## Template placeholders

The plugin's tiny template engine supports three forms:

| Placeholder | Renders as |
|---|---|
| `{{<fieldId>}}` | the user-submitted value for that field |
| `{{fieldLabel:<fieldId>}}` | the field's label as it appeared in the schema |
| `{{all}}` | every field as `Label: value` lines |

`<fieldId>` is the UUID of a field in the form schema, not the label (labels can change).

Example body:

```
New submission to {{fieldLabel:11111111-1111-...}}.

{{all}}
```

## Delivery log

Every dispatch attempt — success or failure — is written to `strapi_forms_notification_delivery_log`. View recent entries by clicking **Recent deliveries** on a rule.

The log captures: rule id, submission id, recipients (snapshot at send time), status, error message, attempted_at.

## Failure semantics

- The public submission response always succeeds (HTTP 201) regardless of notification outcome.
- Notification dispatch is **synchronous** in v1 (called inline from the submission handler). It can be moved to a queue later if it becomes a bottleneck.
- If a single rule throws, other rules still run.
- Errors land in the delivery log, not in the user's response.

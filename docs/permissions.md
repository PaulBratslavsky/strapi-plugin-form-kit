# Permissions and the client-handoff recipe

For v1, the plugin's admin endpoints require an authenticated Strapi admin user (any role). Per-action permissions (form-create vs. submission-read vs. notification-config) are layered on by Strapi's standard role-based access control.

## The "client editor" recipe

A common agency setup: the agency builds the forms; the client only sees submissions.

1. **Settings → Administration Panel → Roles → Create new role.**
2. Name it `Client editor`. Description: "Can read submissions; cannot edit forms."
3. **Plugins → Forms** permissions:
   - ✅ Read forms (so the inbox can resolve field labels)
   - ❌ Create / Update / Delete forms
   - ✅ Read submissions
   - ✅ Update submissions (mark as read / spam, delete)
   - ❌ Notifications and webhooks (admin only)
4. **Settings → Administration Panel → Users → Invite new user**, assign the new role, send the invite.

The client logs in, sees only what they need, exports CSVs, marks submissions, and never touches the form schemas.

## Encryption at rest

Two plugin-stored values are encrypted at rest using AES-256-GCM with a key derived from `APP_KEYS[0]`:

- Webhook configs' `hmacSecret`
- AI provider configs' `apiKey` (Phase 2)

When you rotate `APP_KEYS`, **keep the previous first key in the list** until you've re-saved every webhook secret and AI provider key. Otherwise existing ciphertext can't be decrypted.

## Public submission endpoints

`GET /api/forms/:slug/schema` and `POST /api/forms/:slug/submit` are **public by default** — that's the point. The plugin enforces auth only when the form's `settings.authenticatedOnly` is true (rare).

Honeypot spam protection is on by default. The submit endpoint quietly persists honeypot-triggered submissions as `status='spam'` and returns the success message anyway, so bots can't probe.

## What the plugin never exposes publicly

- Notification rules, webhook configs, AI provider config — admin-only, full stop.
- Direct CRUD on submissions — you must go through the public submit endpoint or the admin endpoints.
- The encrypted secret values (`hmacSecretEncrypted`, `apiKeyEncrypted`) — sanitized out of the admin list/get responses.

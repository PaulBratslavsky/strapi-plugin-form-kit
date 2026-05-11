# Custom field types

Strapi Forms ships with 12 core field types. Host projects (and other plugins) can register additional types that flow through the entire system: visual builder, AI builder, submission validator, and (with one extra step) the embed snippet.

## Registering on the server

In your host plugin's `server/register.ts`:

```ts
import { z } from 'zod';

export default ({ strapi }) => {
  strapi.plugin('forms').service('fieldRegistry').register({
    name: 'address-autocomplete',
    plugin: 'my-custom-fields-plugin',
    storageType: 'json',
    valueSchema: z.object({
      formatted: z.string(),
      lat: z.number(),
      lng: z.number(),
      placeId: z.string(),
    }),
    configSchema: z.object({
      id: z.string().uuid(),
      label: z.string().min(1),
      type: z.literal('address-autocomplete'),
      country: z.string().optional(),
      validations: z.array(z.unknown()).optional(),
    }),
    aiHint: 'Capture a physical address via map autocomplete; stores formatted address + coordinates.',
  });
};
```

That's enough for:
- The form builder's field palette to include this type.
- The submission validator to enforce `valueSchema` against incoming data.
- The AI builder (Phase 2) to consider it in its plan via the `aiHint`.

## Registering on the admin

In your plugin's `admin/src/index.tsx`:

```tsx
import AddressAutocompleteInput from './components/AddressAutocompleteInput';
import AddressAutocompleteConfig from './components/AddressAutocompleteConfig';
import AddressIcon from './components/AddressIcon';

export default {
  register(app) {
    app.getPlugin('forms').registerFieldType({
      name: 'address-autocomplete',           // must match the server-side name
      intlLabel: { id: '…', defaultMessage: 'Address' },
      icon: AddressIcon,
      Input: AddressAutocompleteInput,        // shown in admin previews
      ConfigPanel: AddressAutocompleteConfig, // shown in the visual builder when configuring
    });
  },
};
```

> The admin-side `registerFieldType` API is wired in v1.x. For v1, the visual builder shows custom types via the registry's name and aiHint and edits raw config JSON. The richer `Input` / `ConfigPanel` extension lands soon.

## Public-frontend rendering

The embed snippet renders core types only out of the box. Two ways to handle custom fields on the public frontend:

1. **Pass a `fieldRenderers` map to `renderForm()`** with a renderer per custom type:
   ```ts
   renderForm({
     target,
     baseUrl,
     slug,
     fieldRenderers: {
       'address-autocomplete': ({ field, fieldEl, inputId, setValue, initialValue }) => {
         // build your own DOM into fieldEl, call setValue(...) when the value changes
       },
     },
   });
   ```
2. **Render the form yourself** using the schema endpoint. The `GET /api/forms/<slug>/schema` response is the canonical schema; build whatever frontend you want against it.

## Where the registry is read

- Visual builder field palette
- `GET /forms/admin/field-types` (admin endpoint)
- Submission validator (server-side)
- AI builder prompt construction (Phase 2)

The same `FieldTypeRegistration` instance is the source of truth for all of them.

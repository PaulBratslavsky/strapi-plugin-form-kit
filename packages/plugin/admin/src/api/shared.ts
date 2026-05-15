import { PLUGIN_ID } from '../pluginId';

export const PREFIX = `/${PLUGIN_ID}/admin`;

/**
 * Mirror of `@strapi/admin`'s getToken() — reads the admin JWT from
 * localStorage (preferred, JSON-encoded) with cookie fallback. We can't
 * import their helper because it's not in the public package surface.
 * Needed for the streaming endpoint, which uses raw fetch (useFetchClient
 * wraps axios and can't expose the response body).
 */
export const readAdminJwt = (): string | null => {
  try {
    const raw = window.localStorage.getItem('jwtToken');
    if (raw) return JSON.parse(raw);
  } catch {
    /* fall through */
  }
  const m = document.cookie.match(/(?:^|;\s*)jwtToken=([^;]+)/);
  return m?.[1] ? decodeURIComponent(m[1]) : null;
};

export type FormListEntry = {
  documentId: string;
  name: string;
  slug: string;
  description: string | null;
  publishedAt: string | null;
  updatedAt: string;
  fieldCount: number;
  submissionCount: number;
  newSubmissionCount: number;
};

export type FormDocument = {
  documentId: string;
  name: string;
  slug: string;
  description?: string | null;
  schema: any;
  publishedAt?: string | null;
  updatedAt?: string;
  createdAt?: string;
};

export type FieldTypeEntry = {
  name: string;
  plugin: string;
  storageType: 'string' | 'number' | 'boolean' | 'json';
  aiHint: string;
};

export type ContentTypeEntry = {
  uid: string;
  displayName: string;
  kind: 'collectionType' | 'singleType';
  /** Attribute names of type string/text/uid/email — candidates for labelField. */
  stringAttributes: string[];
};

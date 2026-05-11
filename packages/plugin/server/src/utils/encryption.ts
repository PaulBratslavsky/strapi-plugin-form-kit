import crypto from 'node:crypto';

/**
 * Symmetric encryption helpers for plugin-stored secrets (webhook HMAC secret,
 * AI provider API key). Uses the first APP_KEYS entry as the master key.
 *
 * Storage format: base64(iv || tag || ciphertext). 12-byte IV, 16-byte tag.
 */

const ALG = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;

const getKey = (): Buffer => {
  const appKeys = process.env.APP_KEYS;
  if (!appKeys) {
    throw new Error(
      '[strapi-plugin-forms] APP_KEYS env var must be set to encrypt plugin secrets at rest.'
    );
  }
  const first = appKeys.split(',')[0];
  if (!first) throw new Error('[strapi-plugin-forms] APP_KEYS must contain at least one key.');
  // SHA-256 of the app key normalises any length to 32 bytes for AES-256.
  return crypto.createHash('sha256').update(first).digest();
};

export const encrypt = (plaintext: string): string => {
  const key = getKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALG, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
};

export const decrypt = (ciphertext: string): string => {
  const buf = Buffer.from(ciphertext, 'base64');
  if (buf.length < IV_BYTES + TAG_BYTES + 1) {
    throw new Error('[strapi-plugin-forms] ciphertext too short to be valid');
  }
  const key = getKey();
  const iv = buf.subarray(0, IV_BYTES);
  const tag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const data = buf.subarray(IV_BYTES + TAG_BYTES);
  const decipher = crypto.createDecipheriv(ALG, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
};

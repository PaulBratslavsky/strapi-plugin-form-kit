import { describe, it, expect, beforeEach } from 'vitest';
import { encrypt, decrypt } from './encryption';

describe('encryption helpers', () => {
  beforeEach(() => {
    process.env.APP_KEYS = 'test-key-1,test-key-2';
  });

  it('round-trips a plaintext through encrypt/decrypt', () => {
    const plaintext = 'sk-ant-api03-very-secret-value-xyz';
    const ct = encrypt(plaintext);
    expect(ct).not.toContain(plaintext);
    expect(decrypt(ct)).toBe(plaintext);
  });

  it('produces different ciphertext for the same plaintext (random IV)', () => {
    const a = encrypt('hello');
    const b = encrypt('hello');
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe('hello');
    expect(decrypt(b)).toBe('hello');
  });

  it('throws on tampered ciphertext (auth tag)', () => {
    const ct = encrypt('hello');
    const tampered = Buffer.from(ct, 'base64');
    tampered[tampered.length - 1] ^= 0xff;
    expect(() => decrypt(tampered.toString('base64'))).toThrow();
  });

  it('throws when APP_KEYS is missing', () => {
    delete process.env.APP_KEYS;
    expect(() => encrypt('x')).toThrow(/APP_KEYS/);
  });
});

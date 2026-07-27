import { describe, it, expect } from 'vitest';
import { encryptSecret, decryptSecret, randomToken } from '../src/crypto';

const SECRET = 'test-app-secret-key-abcdefghijklmnop';

describe('encryptSecret / decryptSecret', () => {
  it('round-trips a value without leaking the plaintext', () => {
    const enc = encryptSecret('hunter2', SECRET);
    expect(enc).not.toContain('hunter2');
    expect(enc.startsWith('v1:')).toBe(true);
    expect(decryptSecret(enc, SECRET)).toBe('hunter2');
  });

  it('uses a random IV so ciphertext differs each time', () => {
    expect(encryptSecret('x', SECRET)).not.toBe(encryptSecret('x', SECRET));
  });

  it('fails to decrypt with the wrong secret', () => {
    const enc = encryptSecret('sensitive', SECRET);
    expect(() => decryptSecret(enc, 'a-different-secret-abcdefghijklmnop')).toThrow();
  });

  it('fails on a tampered payload (auth tag mismatch)', () => {
    const enc = encryptSecret('sensitive', SECRET);
    const tampered = `${enc.slice(0, -4)}AAAA`;
    expect(() => decryptSecret(tampered, SECRET)).toThrow();
  });

  it('rejects an unrecognized payload format', () => {
    expect(() => decryptSecret('not-a-valid-payload', SECRET)).toThrow();
  });

  it('handles unicode and empty strings', () => {
    for (const value of ['', '📎 emoji こんにちは', '   spaces   ']) {
      expect(decryptSecret(encryptSecret(value, SECRET), SECRET)).toBe(value);
    }
  });
});

describe('randomToken', () => {
  it('is url-safe and reasonably long', () => {
    const t = randomToken(24);
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(t.length).toBeGreaterThan(24);
    expect(randomToken()).not.toBe(randomToken());
  });
});

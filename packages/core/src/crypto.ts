import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * Symmetric encryption for integration credentials at rest (the BlueBubbles
 * shared password, etc.). Uses AES-256-GCM with a key derived from APP_SECRET.
 *
 * Format: `v1:<base64(iv|authTag|ciphertext)>`.
 */
const VERSION = 'v1';
const IV_LEN = 12;
const TAG_LEN = 16;

function deriveKey(secret: string): Buffer {
  // SHA-256 yields a stable 32-byte key from any-length APP_SECRET.
  return createHash('sha256').update(secret, 'utf8').digest();
}

export function encryptSecret(plaintext: string, secret: string): string {
  const key = deriveKey(secret);
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}:${Buffer.concat([iv, tag, ciphertext]).toString('base64')}`;
}

export function decryptSecret(payload: string, secret: string): string {
  const [version, data] = payload.split(':');
  if (version !== VERSION || !data) {
    throw new Error('Unrecognized encrypted payload format.');
  }
  const raw = Buffer.from(data, 'base64');
  const iv = raw.subarray(0, IV_LEN);
  const tag = raw.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ciphertext = raw.subarray(IV_LEN + TAG_LEN);
  const key = deriveKey(secret);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

/** Constant-ish random token for webhook secrets, invite tokens, etc. */
export function randomToken(bytes = 24): string {
  return randomBytes(bytes).toString('base64url');
}

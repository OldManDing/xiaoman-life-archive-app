import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

import { getSystemConfigEncryptionSecret } from './env-config';

const SECRET_PREFIX = 'enc:v1:';
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

const deriveKey = () => createHash('sha256').update(getSystemConfigEncryptionSecret()).digest();

export const isEncryptedSystemConfigSecret = (value: string | null | undefined) =>
  typeof value === 'string' && value.startsWith(SECRET_PREFIX);

export function encryptSystemConfigSecret(value: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', deriveKey(), iv, { authTagLength: AUTH_TAG_BYTES });
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${SECRET_PREFIX}${Buffer.concat([iv, tag, encrypted]).toString('base64url')}`;
}

export function decryptSystemConfigSecret(value: string | null | undefined): string {
  if (!value) return '';
  if (!isEncryptedSystemConfigSecret(value)) return value;

  const payload = Buffer.from(value.slice(SECRET_PREFIX.length), 'base64url');
  if (payload.length <= IV_BYTES + AUTH_TAG_BYTES) {
    throw new Error('Invalid encrypted system config secret payload');
  }

  const iv = payload.subarray(0, IV_BYTES);
  const tag = payload.subarray(IV_BYTES, IV_BYTES + AUTH_TAG_BYTES);
  const encrypted = payload.subarray(IV_BYTES + AUTH_TAG_BYTES);
  const decipher = createDecipheriv('aes-256-gcm', deriveKey(), iv, { authTagLength: AUTH_TAG_BYTES });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

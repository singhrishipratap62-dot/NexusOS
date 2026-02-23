/**
 * AES-256-GCM token encryption for OAuth credentials at rest.
 * Used by both API and workers to encrypt/decrypt stored tokens.
 */
import {
  createCipheriv,
  createDecipheriv,
  CipherGCM,
  DecipherGCM,
  randomBytes,
  scryptSync
} from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const KEY_BYTES = 32;

function deriveKey(): Buffer {
  const secret =
    process.env.TOKEN_ENCRYPTION_KEY ??
    process.env.JWT_SECRET ??
    'dev-encryption-key-change-in-prod';
  return scryptSync(secret, 'nexusos-token-salt', KEY_BYTES) as Buffer;
}

export function encryptToken(plaintext: string): string {
  const key = deriveKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv) as CipherGCM;
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptToken(ciphertext: string): string {
  const parts = ciphertext.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted token format');
  const [ivHex, tagHex, dataHex] = parts;
  const key = deriveKey();
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex')) as DecipherGCM;
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return decipher.update(Buffer.from(dataHex, 'hex')) + decipher.final('utf8');
}

/** Returns decrypted plaintext if encrypted, or the value as-is (migration safety). */
export function safeDecryptToken(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return decryptToken(value);
  } catch {
    return value; // stored plaintext (pre-encryption migration)
  }
}

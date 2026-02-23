/**
 * AES-256-GCM token encryption for OAuth credentials at rest.
 * Key is derived from TOKEN_ENCRYPTION_KEY env var (32 hex bytes = 64 hex chars).
 * Falls back to JWT_SECRET if not set (dev only — set a dedicated key in production).
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;

function deriveKey(): Buffer {
  const secret = process.env.TOKEN_ENCRYPTION_KEY ?? process.env.JWT_SECRET ?? 'dev-encryption-key-change-in-prod';
  // Derive a stable 32-byte key using scrypt
  return scryptSync(secret, 'nexusos-token-salt', KEY_BYTES);
}

export function encryptToken(plaintext: string): string {
  const key = deriveKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: iv(12):tag(16):ciphertext — all hex-encoded
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptToken(ciphertext: string): string {
  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted token format');
  }
  const [ivHex, tagHex, dataHex] = parts;
  const key = deriveKey();
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const data = Buffer.from(dataHex, 'hex');
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(data) + decipher.final('utf8');
}

/** Returns plaintext if it looks encrypted, otherwise returns as-is (migration safety). */
export function safeDecryptToken(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return decryptToken(value);
  } catch {
    // Token was stored plaintext (pre-encryption migration) — return as-is
    return value;
  }
}

import crypto from "node:crypto";
import { getEnv } from "./env";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12; // 96-bit IV recommended for GCM
const TAG_BYTES = 16;

function getKey(): Buffer {
  const raw = getEnv().TOKEN_ENCRYPTION_KEY;
  // Accept base64 or hex; require exactly 32 bytes once decoded.
  let key: Buffer;
  try {
    key = Buffer.from(raw, "base64");
    if (key.length !== 32) {
      key = Buffer.from(raw, "hex");
    }
  } catch {
    key = Buffer.from(raw, "hex");
  }
  if (key.length !== 32) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY must decode to 32 bytes (use base64 or hex).",
    );
  }
  return key;
}

/**
 * Encrypt a UTF-8 string using AES-256-GCM.
 * Output format: base64( iv(12) || tag(16) || ciphertext )
 */
export function encrypt(plaintext: string): string {
  if (typeof plaintext !== "string") {
    throw new Error("encrypt() expects a string");
  }
  const key = getKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

export function decrypt(payload: string): string {
  const key = getKey();
  const buf = Buffer.from(payload, "base64");
  if (buf.length < IV_BYTES + TAG_BYTES + 1) {
    throw new Error("Encrypted payload is too short to be valid");
  }
  const iv = buf.subarray(0, IV_BYTES);
  const tag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ciphertext = buf.subarray(IV_BYTES + TAG_BYTES);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

/** Helpers that gracefully handle null/undefined for DB nullable columns. */
export function encryptOptional(value: string | null | undefined): string | null {
  if (value == null) return null;
  return encrypt(value);
}

export function decryptOptional(value: string | null | undefined): string | null {
  if (value == null) return null;
  return decrypt(value);
}

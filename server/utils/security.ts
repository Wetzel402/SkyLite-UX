import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

const SALT_LEN = 16;
const KEY_LEN = 64;
const PREFIX = "SCRYPT:";

/**
 * Hashes a PIN using scrypt.
 * Format: SCRYPT:<salt_hex>:<derived_key_hex>
 */
export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(SALT_LEN).toString("hex");
  const derivedKey = (await scryptAsync(pin, salt, KEY_LEN)) as Buffer;
  return `${PREFIX}${salt}:${derivedKey.toString("hex")}`;
}

/**
 * Verifies a PIN against a stored hash.
 * Returns false if the hash format is invalid or verification fails.
 */
export async function verifyPin(pin: string, storedHash: string): Promise<boolean> {
  if (!storedHash || !storedHash.startsWith(PREFIX)) {
    return false;
  }

  const parts = storedHash.slice(PREFIX.length).split(":");
  if (parts.length !== 2) {
    return false;
  }

  const [salt, keyHex] = parts;
  const keyBuffer = Buffer.from(keyHex, "hex");

  try {
    const derivedKey = (await scryptAsync(pin, salt, KEY_LEN)) as Buffer;
    return timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}

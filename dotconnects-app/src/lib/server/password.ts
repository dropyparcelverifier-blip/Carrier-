import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

/**
 * Password hashing for admin_users.password_hash — scrypt via Node's
 * built-in crypto rather than adding bcrypt/argon2 as a dependency.
 * Stored format: "<salt-hex>:<hash-hex>".
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hashHex] = stored.split(":");
  if (!salt || !hashHex) return false;
  const hash = scryptSync(password, salt, 64);
  const stored_ = Buffer.from(hashHex, "hex");
  if (hash.length !== stored_.length) return false;
  return timingSafeEqual(hash, stored_);
}

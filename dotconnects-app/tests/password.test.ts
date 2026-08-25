import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "$lib/server/password";

describe("hashPassword / verifyPassword", () => {
  it("verifies a password against its own hash", () => {
    const hash = hashPassword("correct-horse-battery-staple");
    expect(verifyPassword("correct-horse-battery-staple", hash)).toBe(true);
  });

  it("rejects a wrong password", () => {
    const hash = hashPassword("correct-horse-battery-staple");
    expect(verifyPassword("wrong-password", hash)).toBe(false);
  });

  it("produces a different hash each time due to a random salt", () => {
    const a = hashPassword("same-password");
    const b = hashPassword("same-password");
    expect(a).not.toBe(b);
  });

  it("stores as '<salt-hex>:<hash-hex>'", () => {
    const hash = hashPassword("x");
    const parts = hash.split(":");
    expect(parts).toHaveLength(2);
    expect(parts[0]).toMatch(/^[0-9a-f]{32}$/);
    expect(parts[1]).toMatch(/^[0-9a-f]{128}$/);
  });

  it("rejects a malformed stored value instead of throwing", () => {
    expect(verifyPassword("anything", "not-a-valid-hash")).toBe(false);
    expect(verifyPassword("anything", "")).toBe(false);
  });

  it("is case- and whitespace-sensitive", () => {
    const hash = hashPassword("Password1");
    expect(verifyPassword("password1", hash)).toBe(false);
    expect(verifyPassword("Password1 ", hash)).toBe(false);
  });
});

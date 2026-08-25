import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkRateLimit, clearRateLimit, recordFailedAttempt } from "./rate-limit";

describe("rate-limit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows a key with no recorded attempts", () => {
    expect(checkRateLimit("fresh-key")).toEqual({ limited: false });
  });

  it("stays unlimited under the 5-attempt threshold", () => {
    const key = "under-threshold";
    for (let i = 0; i < 4; i++) recordFailedAttempt(key);
    expect(checkRateLimit(key)).toEqual({ limited: false });
  });

  it("limits after the 5th failed attempt within the window", () => {
    const key = "over-threshold";
    for (let i = 0; i < 5; i++) recordFailedAttempt(key);
    const result = checkRateLimit(key);
    expect(result.limited).toBe(true);
    if (result.limited) {
      expect(result.retryAfterSeconds).toBeGreaterThan(0);
      expect(result.retryAfterSeconds).toBeLessThanOrEqual(15 * 60);
    }
  });

  it("resets once the 15-minute window has fully elapsed", () => {
    const key = "window-expiry";
    for (let i = 0; i < 5; i++) recordFailedAttempt(key);
    expect(checkRateLimit(key).limited).toBe(true);

    vi.advanceTimersByTime(15 * 60 * 1000 + 1);
    expect(checkRateLimit(key)).toEqual({ limited: false });
  });

  it("clearRateLimit immediately un-limits a key", () => {
    const key = "cleared";
    for (let i = 0; i < 5; i++) recordFailedAttempt(key);
    expect(checkRateLimit(key).limited).toBe(true);

    clearRateLimit(key);
    expect(checkRateLimit(key)).toEqual({ limited: false });
  });

  it("tracks separate keys independently", () => {
    for (let i = 0; i < 5; i++) recordFailedAttempt("key-a");
    expect(checkRateLimit("key-a").limited).toBe(true);
    expect(checkRateLimit("key-b").limited).toBe(false);
  });
});

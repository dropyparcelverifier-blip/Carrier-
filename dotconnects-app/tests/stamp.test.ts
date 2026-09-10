import { describe, it, expect } from "vitest";
import { stampFor, parseStamp, nowIST } from "../src/lib/dates";

describe("stampFor — what goes in happened_at", () => {
  it("is machine-readable, unlike what it replaced", () => {
    const d = new Date("2026-09-10T12:31:00Z");
    expect(stampFor(d)).toBe("2026-09-10T12:31:00.000Z");
    expect(new Date(stampFor(d)).getTime()).toBe(d.getTime());
  });
  it("the OLD value could not be parsed at all", () => {
    // "10 Sept 2026, 18:01 IST" — the Invalid Date in the admin timeline.
    expect(Number.isNaN(new Date(nowIST(new Date())).getTime())).toBe(true);
  });
  it("a bad input still yields a valid instant rather than a broken row", () => {
    expect(Number.isNaN(new Date(stampFor("not a date")).getTime())).toBe(false);
  });
});

describe("parseStamp — reads both shapes", () => {
  it("reads ISO", () => {
    expect(parseStamp("2026-09-10T12:31:00.000Z")?.toISOString())
      .toBe("2026-09-10T12:31:00.000Z");
  });
  it("recovers a legacy IST display string", () => {
    // 18:01 IST on 10 Sept = 12:31 UTC.
    expect(parseStamp("10 Sept 2026, 18:01 IST")?.toISOString())
      .toBe("2026-09-10T12:31:00.000Z");
  });
  it("handles the months Date already accepts", () => {
    expect(parseStamp("10 Sep 2026, 18:01 IST")?.toISOString())
      .toBe("2026-09-10T12:31:00.000Z");
  });
  it("returns null rather than an Invalid Date", () => {
    expect(parseStamp("")).toBeNull();
    expect(parseStamp(null)).toBeNull();
    expect(parseStamp("nonsense")).toBeNull();
  });
  it("round-trips whatever stampFor writes", () => {
    const d = new Date("2026-12-31T18:29:59Z");
    expect(parseStamp(stampFor(d))?.getTime()).toBe(d.getTime());
  });
});

import { describe, expect, it, vi, afterEach } from "vitest";
import { relativeDays } from "./dates";

describe("relativeDays", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns null for an unparseable date string", () => {
    expect(relativeDays("not a date")).toBeNull();
    expect(relativeDays("")).toBeNull();
  });

  it("returns 'Today' for the current calendar day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-13T09:00:00"));
    expect(relativeDays("13 Aug 2026")).toBe("Today");
  });

  it("returns 'Tomorrow' for the next calendar day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-13T09:00:00"));
    expect(relativeDays("14 Aug 2026")).toBe("Tomorrow");
  });

  it("returns 'Yesterday' for the previous calendar day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-13T09:00:00"));
    expect(relativeDays("12 Aug 2026")).toBe("Yesterday");
  });

  it("returns 'In N days' for a future date beyond tomorrow", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-13T09:00:00"));
    expect(relativeDays("18 Aug 2026")).toBe("In 5 days");
  });

  it("returns 'N days ago' for a past date beyond yesterday", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-13T09:00:00"));
    expect(relativeDays("08 Aug 2026")).toBe("5 days ago");
  });

  it("ignores time-of-day — whole calendar-day diff, not a 24h rolling window", () => {
    // "now" is 23:50 on the 13th; the target is the 14th at 00:10 — under
    // 24 real hours apart, but a different calendar day, so this must
    // still read as "Tomorrow", not "Today".
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-13T23:50:00"));
    expect(relativeDays("14 Aug 2026 00:10")).toBe("Tomorrow");
  });
});

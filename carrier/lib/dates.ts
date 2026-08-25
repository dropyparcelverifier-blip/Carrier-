/**
 * A bare date ("10 Aug 2026") makes a customer do the subtraction
 * themselves. This does it for them — "in 3 days" is the thing that's
 * actually easy to scan, the exact date is what confirms it. Whole-day
 * diff (midnight to midnight), not a 24h rolling window, so "tomorrow"
 * means the calendar day after today regardless of what time it is now.
 */
export function relativeDays(dateStr: string): string | null {
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return null;

  const now = new Date();
  const target = Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((target - today) / 86_400_000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  if (diffDays > 1) return `In ${diffDays} days`;
  return `${Math.abs(diffDays)} days ago`;
}

/**
 * A timeline timestamp genuinely converted to IST, not just labeled IST.
 * `new Date().toLocaleString("en-GB", {...}) + " IST"` — the pattern this
 * replaces, duplicated across 4 call sites (the admin PATCH route,
 * lib/order-status.ts, lib/create-order.ts, the Shiprocket webhook route)
 * — formats in whatever timezone the CODE RUNS IN (Vercel's serverless
 * functions run in UTC) and then just appends the literal string " IST"
 * without ever actually converting. Every real order's timeline
 * timestamps have been off by 5:30 (UTC clock-time, IST label) since this
 * pattern was first written. `timeZone: "Asia/Kolkata"` is what actually
 * does the conversion; everything else here matches the old visual format
 * ("20 Aug 2026, 18:26 IST") so existing stored strings/tests aren't
 * broken, just corrected.
 */
export function nowIST(date: Date = new Date()): string {
  return date.toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }) + " IST";
}

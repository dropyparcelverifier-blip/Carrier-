/**
 * Working days to a calendar window — ONE definition.
 *
 * shipping_days is working days. Turning it into a calendar window was
 * done in four places, and create-order.ts rounded up while the clock did
 * not: 12 working days became 15 calendar days for the stored ETA and
 * 14.4 for the timeline. The admin said "24 Sept 15:06" and the customer
 * page said "25 Sept" for the same order — 14h24m apart, which is exactly
 * the rounding.
 *
 * Rounded UP, because the customer is shown a date, and a promise that
 * lands mid-afternoon on day 14.4 is a promise for day 15.
 */
export const CALENDAR_FACTOR = 1.2;
export const calendarDays = (workingDays: number) =>
  Math.ceil(Number(workingDays) * CALENDAR_FACTOR);
export const calendarWindowMs = (workingDays: number) =>
  calendarDays(workingDays) * 24 * 60 * 60 * 1000;

/**
 * The stored-ETA format, in one place.
 *
 * "15 Sep 2026". Written into estimated_delivery at create-order and at
 * both add-days endpoints, each of which spelled the options out again.
 */
export function formatEta(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

/**
 * Both dates a parcel has, from the columns that already exist.
 *
 * dropy  — arrival at the Vashi warehouse. Same arithmetic that writes
 *          estimated_delivery, so the two cannot disagree.
 * doorstep — arrival at the customer's address, or null when there is no
 *          figure for the pincode.
 *
 * Derived, never stored as a second date. estimated_delivery is a STORED
 * STRING and moving shipping_days without it left customers on a stale
 * date once already; a stored doorstep date would be a third thing that
 * had to move in step. One number moves both.
 */
export function etaFor(row: {
  order_date: string;
  shipping_days: number;
  doorstep_days?: number | null;
}): { dropy: Date; doorstep: Date | null } {
  const dropy = new Date(row.order_date);
  dropy.setDate(dropy.getDate() + calendarDays(row.shipping_days));

  const extra = Number(row.doorstep_days);
  if (!Number.isFinite(extra) || extra <= 0) return { dropy, doorstep: null };

  const doorstep = new Date(dropy);
  doorstep.setDate(doorstep.getDate() + Math.ceil(extra));
  return { dropy, doorstep };
}

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
/**
 * A timestamp for STORAGE, not for reading.
 *
 * happened_at held nowIST() output — "10 Sept 2026, 18:01 IST". That is
 * a display string: "Sept" is not a month abbreviation Date accepts,
 * " IST" is not a zone it knows, and the comma format is non-standard.
 * new Date() on it returns Invalid Date, which is exactly what the admin
 * stage timeline showed.
 *
 * ISO in the column; nowIST at the point of display, where it belongs.
 */
export function stampFor(date: Date | string = new Date()): string {
  const d = date instanceof Date ? date : new Date(date);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

/**
 * Reads either shape.
 *
 * Rows written before the change carry the IST display string. Rather
 * than migrate them, parse both — the legacy form is recoverable because
 * only the month abbreviation and the zone suffix are unusual.
 */
export function parseStamp(v: unknown): Date | null {
  const raw = String(v ?? "").trim();
  if (!raw) return null;
  const direct = new Date(raw);
  if (!Number.isNaN(direct.getTime())) return direct;
  // "10 Sept 2026, 18:01 IST" -> "10 Sep 2026 18:01 +05:30"
  const legacy = raw
    .replace(/\bSept\b/i, "Sep")
    .replace(/,/g, "")
    .replace(/\s*IST$/i, " +05:30");
  const parsed = new Date(legacy);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function nowIST(date: Date = new Date()): string {
  return date.toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }) + " IST";
}

/**
 * A stored stamp, split for display.
 *
 * happened_at now holds ISO. The customer journey used to pull it apart
 * with string surgery — split on the comma, strip " IST" — which worked
 * only for the display string it used to hold, and rendered the whole ISO
 * value into the date slot once that changed.
 *
 * Formatting belongs here, once, and it reads either shape: rows written
 * before the change still carry the old form.
 */
export function splitStamp(v: unknown): { date: string; time: string } {
  const d = parseStamp(v);
  if (!d) return { date: "", time: "" };
  const at = (opts: Intl.DateTimeFormatOptions) =>
    d.toLocaleString("en-GB", { ...opts, timeZone: "Asia/Kolkata" });
  return {
    date: at({ day: "2-digit", month: "short" }),
    time: at({ hour: "2-digit", minute: "2-digit", hour12: false }),
  };
}

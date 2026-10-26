import { env } from "$env/dynamic/private";

/**
 * Doorstep days for an order created in DOT by hand (a Rudra order, or a
 * Dropy order typed into the New-order form) — fetched from Order Central.
 *
 * DOT has no Shiprocket login and must not get one: only DOC holds it.
 * DOC already works this number out on every push (serviceabilityDays:
 * 1 day buffer + ceil(median Shiprocket courier days), pickup 400705), so
 * DOT asks DOC for it here and gets exactly what a Dropy order gets.
 *
 * Auth: the bridge secret both apps already share (DOT's
 * ORDER_CENTRAL_BRIDGE_SECRET = DOC's DOT_BRIDGE_SECRET). No new
 * credentials anywhere. DOC's address defaults to the live DOC; set
 * ORDER_CENTRAL_URL only if it ever moves.
 *
 * Never throws and never blocks an order: no secret, DOC down, a timeout
 * or an odd reply all return null, and the customer sees the Vashi date
 * alone — as before this existed.
 */

const TIMEOUT_MS = 12_000; // DOC's own Shiprocket call allows 8 s
const DEFAULT_DOC = "https://doc-rebuilt.vercel.app";

export async function doorstepDaysFor(opts: {
  pincode: string | null | undefined;
  weightKg?: number | null;
  cod?: boolean;
  declaredInr?: number | null;
}): Promise<number | null> {
  try {
    const pin = String(opts.pincode ?? "").replace(/\D/g, "");
    if (!/^\d{6}$/.test(pin)) return null;
    const secret = env.ORDER_CENTRAL_BRIDGE_SECRET ?? process.env.ORDER_CENTRAL_BRIDGE_SECRET;
    if (!secret) return null;
    const base = String(env.ORDER_CENTRAL_URL || DEFAULT_DOC).replace(/\/+$/, "");
    const q = new URLSearchParams({
      pincode: pin,
      weight_kg: String(Math.max(0.5, Number(opts.weightKg) || 0.5)),
      cod: opts.cod ? "1" : "0",
      value: String(Math.max(0, Math.round(Number(opts.declaredInr) || 0))),
    });
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(`${base}/api/webhook/dot-doorstep?${q}`, {
        headers: { "x-bridge-secret": secret }, signal: ctl.signal,
      });
    } finally { clearTimeout(t); }
    if (!res.ok) {
      console.error("[doorstep] DOC answered", res.status);
      return null;
    }
    const j: any = await res.json().catch(() => null);
    const n = Number(j?.doorstep_days);
    return Number.isFinite(n) && n >= 1 && n <= 30 ? Math.ceil(n) : null;
  } catch (e) {
    console.error("[doorstep] lookup failed:", e instanceof Error ? e.message : String(e));
    return null;
  }
}

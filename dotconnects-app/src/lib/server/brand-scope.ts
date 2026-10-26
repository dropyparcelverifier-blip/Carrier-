import { json } from "@sveltejs/kit";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminIdentity } from "$lib/server/admin-session";
import { byOrderRef } from "$lib/server/order-ref";

/**
 * Keeps a brand login inside its own orders.
 *
 * Returns null when the caller may go on, or a 404 Response when it may
 * not. "Not found", never "forbidden": a Rudra admin must not be able to
 * learn that a Dropy order with that id exists.
 *
 * For the Dropy team and for Order Central (identity.brand null/absent)
 * this returns null IMMEDIATELY with no query, so every route DOC calls
 * runs exactly as it did before brands existed.
 */
export async function outOfScope(
  guard: { identity?: AdminIdentity | null; supabase: SupabaseClient },
  ref: string,
): Promise<Response | null> {
  const brand = guard.identity?.brand;
  if (!brand) return null;
  const { data } = await byOrderRef(
    guard.supabase.from("dropy_orders").select("id, brand"),
    ref,
  ).maybeSingle();
  if (!data || (data as { brand?: string }).brand !== brand) {
    return json({ error: "Order not found" }, { status: 404 });
  }
  return null;
}

/** True when an order belongs to Dropy (DOC runs its India leg and its fixes). */
export function isDropyOrder(order: { brand?: string | null } | null | undefined): boolean {
  return !order?.brand || order.brand === "dropy";
}

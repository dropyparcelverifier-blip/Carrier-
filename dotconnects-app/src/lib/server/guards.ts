import { json } from "@sveltejs/kit";
import type { Cookies } from "@sveltejs/kit";
import { requireAdminIdentity, type AdminIdentity } from "$lib/server/admin-session";
import { getSupabaseAdmin } from "$lib/server/supabase-admin";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Route guards.
 *
 * The Next version repeated this preamble in every handler — session
 * check, role check, supabase null check — which is how one route ends up
 * missing a check nobody notices. One place, used everywhere.
 */

export type Guarded =
  | { ok: true; identity: AdminIdentity; supabase: SupabaseClient }
  | { ok: false; response: Response };

export async function requireStaff(cookies: Cookies): Promise<Guarded> {
  const identity = await requireAdminIdentity(cookies);
  if (!identity) {
    return { ok: false, response: json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { ok: false, response: json({ error: "Supabase not configured" }, { status: 503 }) };
  }
  return { ok: true, identity, supabase };
}

/**
 * Admin-only. Gated because these are the actions an audit log cannot
 * compensate for: if any user can create accounts, someone can make an
 * account, act, delete it, and leave the log pointing at nobody.
 */
export async function requireAdmin(cookies: Cookies): Promise<Guarded> {
  const guard = await requireStaff(cookies);
  if (!guard.ok) return guard;
  if (guard.identity.role !== "admin") {
    return { ok: false, response: json({ error: "Admin role required" }, { status: 403 }) };
  }
  return guard;
}

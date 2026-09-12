import { json } from "@sveltejs/kit";
import type { Cookies } from "@sveltejs/kit";
import { requireAdminIdentity, type AdminIdentity } from "$lib/server/admin-session";
import { getSupabaseAdmin } from "$lib/server/supabase-admin";
import { checkBridgeSecret } from "$lib/server/bridge-auth";
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
/**
 * A signed-in teammate OR Order Central, on the same endpoint.
 *
 * DOC is where the team actually works, so the actions that used to be
 * admin-panel-only have to be reachable from there too -- but DOC is a
 * server calling a server, with no session cookie to present. The
 * alternative was a second set of bridge-authenticated routes doing the
 * same thing, and two implementations of "cancel this parcel" will
 * disagree eventually; the one that gets fixed is whichever the person
 * reporting the bug happened to use.
 *
 * So: one endpoint, two ways in. The audit trail records which, because
 * "who cancelled this?" is the first question anyone asks, and "Order
 * Central" is a real answer while a blank actor is not.
 */
export async function requireStaffOrBridge(
  cookies: Cookies,
  request: Request,
): Promise<Guarded> {
  const identity = await requireAdminIdentity(cookies);
  if (identity) {
    const supabase = getSupabaseAdmin();
    if (!supabase) return { ok: false, response: json({ error: "Supabase not configured" }, { status: 503 }) };
    return { ok: true, identity, supabase };
  }
  if (checkBridgeSecret(request)) {
    const supabase = getSupabaseAdmin();
    if (!supabase) return { ok: false, response: json({ error: "Supabase not configured" }, { status: 503 }) };
    /* Named, not anonymous. A bridge call with no actor leaves an audit
       row pointing at nobody. */
    return { ok: true, identity: { id: null, username: "Order Central (DOC)", role: "admin" }, supabase };
  }
  return { ok: false, response: json({ error: "Unauthorized" }, { status: 401 }) };
}

export async function requireAdmin(cookies: Cookies): Promise<Guarded> {
  const guard = await requireStaff(cookies);
  if (!guard.ok) return guard;
  if (guard.identity.role !== "admin") {
    return { ok: false, response: json({ error: "Admin role required" }, { status: 403 }) };
  }
  return guard;
}

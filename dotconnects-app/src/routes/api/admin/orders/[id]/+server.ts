import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requireStaff, requireAdmin } from "$lib/server/guards";
import { logAudit } from "$lib/server/audit";
import { mapRow } from "$lib/server/shipment-service";

/** Event history for one order. */
export const GET: RequestHandler = async ({ cookies, params }) => {
  const guard = await requireStaff(cookies);
  if (!guard.ok) return guard.response;

  const { data, error } = await guard.supabase
    .from("dropy_order_events")
    .select("*")
    .eq("order_id", params.id)
    .order("sort_order", { ascending: true });

  if (error) return json({ error: error.message }, { status: 500 });

  /* The order itself, not just its events.
   *
   * The detail page used to fetch /api/admin/orders?pageSize=100 and hunt
   * for one row client-side. An order outside that page simply was not
   * found, and a hundred rows were transferred to render one. Sections
   * come from the same view the list uses, so live_stage and the derived
   * status stay identical between the two screens. */
  const { data: order } = await guard.supabase
    .from("dropy_orders_sectioned")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  /* The route map, built by the SAME function the customer page uses, so
   * the marker an operator sees is the marker the customer sees. A failure
   * is reported, not papered over: the page says why there is no map. */
  let route: { origin: string; destination: string; progress: number; mode: string } | null = null;
  let routeError = "";
  if (order) {
    try {
      const s = mapRow({ ...order, dropy_order_events: data ?? [] } as any);
      route = { origin: s.origin, destination: s.destination, progress: s.progress, mode: s.mode };
    } catch (e) {
      routeError = e instanceof Error ? e.message : String(e);
      console.error("[admin] route map failed for order", params.id, e);
    }
  }

  return json({ order: order ?? null, events: data ?? [], route, routeError });
};

/**
 * SOFT delete — admin only.
 *
 * The row and its whole event trail survive; every read path filters
 * deleted_at is null. A hard delete with no undo is the wrong default
 * once more than one person has the button.
 */
export const DELETE: RequestHandler = async ({ cookies, params }) => {
  const guard = await requireAdmin(cookies);
  if (!guard.ok) return guard.response;
  const { supabase, identity } = guard;

  // Read first so the audit row records WHAT was deleted. Without this
  // the log says "someone deleted something" and nothing more.
  const { data: existing } = await supabase
    .from("dropy_orders")
    .select("tracking_id, customer_name, deleted_at")
    .eq("id", params.id)
    .maybeSingle();

  if (!existing) return json({ error: "Order not found" }, { status: 404 });
  if (existing.deleted_at) return json({ error: "Order is already deleted" }, { status: 409 });

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("dropy_orders")
    .update({ deleted_at: now, deleted_by: identity.id })
    .eq("id", params.id);

  if (error) return json({ error: error.message }, { status: 500 });

  await logAudit(identity, {
    action: "order.delete",
    orderId: params.id,
    before: { deleted_at: null },
    after: { deleted_at: now },
    note: `Deleted ${existing.tracking_id} (${existing.customer_name})`,
  });

  return json({ ok: true, softDeleted: true });
};

/**
 * Finding the order a courier event belongs to.
 *
 * Shared by both courier endpoints because they had drifted: -b stripped
 * the leading "#" from an inbound reference and -a did not, so the same
 * order id matched on one and missed on the other.
 *
 * The hard part is splits. One customer order can ship from the US as
 * several parcels, stored as Dropy-4251-1 and Dropy-4251-2. An Indian
 * courier never sees that — it collected one consolidated box and knows
 * only "Dropy-4251". An exact match therefore finds NOTHING on exactly
 * the orders that matter most.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type Consignment = {
  id: string; dropy_order_id: string; tracking_id: string;
  current_stage: string; picked_up_at: string | null;
};

/** Shiprocket sends "Dropy-3798"; ours may be stored "#Dropy-4731". */
export const bareRef = (v: unknown) => String(v ?? "").trim().replace(/^#/, "");

/**
 * Every consignment a courier reference could mean.
 *
 * Matches the id exactly AND as a split prefix, so "Dropy-4251" returns
 * -1 and -2. Ordered so the base id, if one exists, comes first.
 */
export async function findConsignments(
  supabase: SupabaseClient, refs: string[], awb: string,
): Promise<Consignment[]> {
  const clean = [...new Set(refs.map(bareRef).filter(Boolean))];
  // PostgREST treats , and . as syntax inside or(); a reference carrying
  // either would silently reshape the filter rather than fail.
  const safe = clean.filter((r) => !/[,.()]/.test(r));
  const filters = [
    ...safe.flatMap((r) => [
      `dropy_order_id.eq.${r}`,
      `tracking_id.eq.${r}`,
      // The split case. "-%" cannot match the base id itself.
      `dropy_order_id.like.${r}-%`,
    ]),
    ...(awb ? [`last_mile_awb.eq.${awb}`] : []),
  ];
  if (!filters.length) return [];

  const { data } = await supabase
    .from("dropy_orders")
    .select("id, dropy_order_id, tracking_id, current_stage, picked_up_at")
    .or(filters.join(","))
    .is("deleted_at", null)
    .order("dropy_order_id")
    .limit(10);
  return (data as Consignment[]) ?? [];
}

/**
 * Whether a courier event may advance these consignments.
 *
 * ONE consignment: unambiguous — that is the box.
 *
 * SEVERAL: the courier collected one consolidated box and cannot say
 * which parcels were in it. If split A has landed and been shipped while
 * split B is still in customs, advancing both would tell a customer an
 * item is out for delivery while it is over the Arabian Sea. So the
 * event is recorded and nothing moves; a person decides.
 *
 * This is a stopgap. Order Central knows what went in the box because it
 * packs it, and will say so explicitly once courier injection is built.
 */
export const canAdvance = (rows: Consignment[]) => rows.length === 1;

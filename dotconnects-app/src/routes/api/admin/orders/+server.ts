import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requireStaff } from "$lib/server/guards";
import {
  SECTION_KEYS, isSectionKey, clampPage, clampPageSize,
  pageRange, totalPages, sectionOrder, type SectionKey,
} from "$lib/order-sections";
import { anchorFromRow, anchoredSuggestedStage } from "$lib/stage-clock";
import { effectiveOrderStage } from "$lib/order-routes";
import { STAGES } from "$lib/types";

/**
 * Admin orders list — sectioned, filtered and paginated in SQL.
 *
 * Sections come from the dropy_orders_sectioned view, which derives them
 * server-side including overdue — still computed, never stored, so
 * add-days un-overdues an order on the very next query.
 */
export const GET: RequestHandler = async ({ cookies, url }) => {
  const guard = await requireStaff(cookies);
  if (!guard.ok) return guard.response;
  const { supabase } = guard;

  const sectionParam = url.searchParams.get("section");
  const section: SectionKey | null = isSectionKey(sectionParam) ? sectionParam : null;
  const page = clampPage(url.searchParams.get("page"));
  const pageSize = clampPageSize(url.searchParams.get("pageSize"));
  const search = (url.searchParams.get("q") ?? "").trim();

  // Counts for every tab in one round trip. head:true asks Postgres for
  // the count without shipping any rows.
  const countPromises = SECTION_KEYS.map((key) =>
    supabase
      .from("dropy_orders_sectioned")
      .select("id", { count: "exact", head: true })
      .eq("section", key)
      .then((r) => [key, r.count ?? 0] as const),
  );

  const [from, to] = pageRange(page, pageSize);
  const order = sectionOrder(section ?? "transit");

  let rows = supabase
    .from("dropy_orders_sectioned")
    .select("*", { count: "exact" })
    .neq("section", "deleted");

  if (section) rows = rows.eq("section", section);

  for (const [param, column] of [
    ["paymentStatus", "payment_status"],
    ["mode", "shipping_mode"],
    ["city", "customer_city"],
  ] as const) {
    const v = url.searchParams.get(param);
    if (v) rows = rows.eq(column, v);
  }
  const dateFrom = url.searchParams.get("dateFrom");
  const dateTo = url.searchParams.get("dateTo");
  if (dateFrom) rows = rows.gte("created_at", dateFrom);
  // End of day, not 00:00 — a bare date would exclude every order
  // actually placed ON that day.
  if (dateTo) rows = rows.lte("created_at", `${dateTo}T23:59:59.999`);

  if (search) {
    // Escape PostgREST pattern metacharacters so a search for "%" can't
    // widen into every row.
    const esc = search.replace(/[%_,]/g, (c) => `\\${c}`);
    rows = rows.or(
      [
        `tracking_id.ilike.%${esc}%`,
        `dropy_order_id.ilike.%${esc}%`,
        `us_order_id.ilike.%${esc}%`,
        `customer_name.ilike.%${esc}%`,
        `customer_mobile.ilike.%${esc}%`,
      ].join(","),
    );
  }

  const [counts, result] = await Promise.all([
    Promise.all(countPromises),
    rows.order(order.column, { ascending: order.ascending }).range(from, to),
  ]);

  if (result.error) {
    console.error("orders list failed:", result.error);
    return json({ error: result.error.message }, { status: 500 });
  }

  // The stored `status` column only changes when someone saves, so a
  // parcel five days into transit still reads "Order Placed" here while
  // the customer's tracker shows the live stage. Derived with the same
  // helpers so both screens agree about one order.
  const orders = (result.data ?? []).map((row: any) => {
    const anchor = anchorFromRow(row.clock_anchor_stage, row.clock_anchor_at);
    const realEvent = row.picked_up_at
      ? "handed_to_courier"
      : row.label_generated_at
        ? "qc_check"
        : null;
    const held = row.current_stage === "damaged" || row.current_stage === "exception";

    const liveStage = held
      ? row.current_stage
      : (realEvent ??
          (anchor
            ? (anchoredSuggestedStage(row.route_key, row.order_date, row.shipping_days, anchor)
                ?? row.current_stage)
            : effectiveOrderStage(
                row.route_key, row.current_stage, row.order_date,
                row.shipping_days, row.timing_seed ?? 0,
              )));

    return {
      ...row,
      live_stage: liveStage,
      live_status: STAGES.find((s) => s.key === liveStage)?.label ?? row.status,
    };
  });

  const total = result.count ?? 0;
  return json({
    orders,
    counts: Object.fromEntries(counts),
    page, pageSize, total,
    totalPages: totalPages(total, pageSize),
    section,
  });
};

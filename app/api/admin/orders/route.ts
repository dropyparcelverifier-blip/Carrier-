import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-session";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { insertNewOrder, validateNewOrder, type NewOrderInput } from "@/lib/create-order";
import {
  SECTION_KEYS, isSectionKey, clampPage, clampPageSize,
  pageRange, totalPages, sectionOrder, type SectionKey,
} from "@/lib/order-sections";

export const dynamic = "force-dynamic";

/**
 * Admin orders list — server-side sectioned, filtered and paginated.
 *
 * Previously this did select("*") with no limit and the client sliced 25.
 * At 700-1000 orders/month that becomes ~10,000 rows fetched on every
 * page load within a year, and the section counts could only be produced
 * by pulling the whole table first.
 *
 * Sections come from the dropy_orders_sectioned view, which derives them
 * in SQL — including overdue, which is still computed and never stored
 * (architecture §6). See supabase/migration-v3.sql.
 */
export async function GET(request: Request) {
  try {
    const admin = await requireAdminSession();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = getSupabaseAdmin();
    if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

    const url = new URL(request.url);
    const sectionParam = url.searchParams.get("section");
    const section: SectionKey | null = isSectionKey(sectionParam) ? sectionParam : null;
    const page = clampPage(url.searchParams.get("page"));
    const pageSize = clampPageSize(url.searchParams.get("pageSize"));
    const search = (url.searchParams.get("q") ?? "").trim();

    // Counts for every tab in ONE round trip rather than six. head:true
    // asks Postgres for the count without shipping any rows back.
    const countPromises = SECTION_KEYS.map((key) =>
      supabase
        .from("dropy_orders_sectioned")
        .select("id", { count: "exact", head: true })
        .eq("section", key)
        .then((r) => [key, r.count ?? 0] as const),
    );

    const [from, to] = pageRange(page, pageSize);
    const order = sectionOrder(section ?? "transit");

    let rowsQuery = supabase
      .from("dropy_orders_sectioned")
      .select("*", { count: "exact" })
      .neq("section", "deleted");

    if (section) rowsQuery = rowsQuery.eq("section", section);

    // Filters carried over from the old client-side OrderList. They MUST
    // be server-side now: a client filter applied after pagination would
    // only ever filter the 25 rows on screen, silently hiding matches on
    // every other page.
    const paymentStatus = url.searchParams.get("paymentStatus");
    const mode = url.searchParams.get("mode");
    const city = url.searchParams.get("city");
    const dateFrom = url.searchParams.get("dateFrom");
    const dateTo = url.searchParams.get("dateTo");

    if (paymentStatus) rowsQuery = rowsQuery.eq("payment_status", paymentStatus);
    if (mode) rowsQuery = rowsQuery.eq("shipping_mode", mode);
    if (city) rowsQuery = rowsQuery.eq("customer_city", city);
    if (dateFrom) rowsQuery = rowsQuery.gte("created_at", dateFrom);
    // End-of-day, not 00:00 — a bare date would exclude every order
    // actually placed ON that day. Same fix the old client filter had.
    if (dateTo) rowsQuery = rowsQuery.lte("created_at", `${dateTo}T23:59:59.999`);

    if (search) {
      // Escape PostgREST pattern metacharacters so a search for "%" can't
      // widen into every row.
      const esc = search.replace(/[%_,]/g, (c) => `\\${c}`);
      rowsQuery = rowsQuery.or(
        [
          `tracking_id.ilike.%${esc}%`,
          `dropy_order_id.ilike.%${esc}%`,
          `us_order_id.ilike.%${esc}%`,
          `customer_name.ilike.%${esc}%`,
          `customer_mobile.ilike.%${esc}%`,
        ].join(","),
      );
    }

    const [counts, rowsResult] = await Promise.all([
      Promise.all(countPromises),
      rowsQuery.order(order.column, { ascending: order.ascending }).range(from, to),
    ]);

    if (rowsResult.error) {
      console.error("Supabase GET orders error:", rowsResult.error);
      return NextResponse.json({ error: rowsResult.error.message }, { status: 500 });
    }

    const total = rowsResult.count ?? 0;

    return NextResponse.json({
      orders: rowsResult.data ?? [],
      counts: Object.fromEntries(counts),
      page,
      pageSize,
      total,
      totalPages: totalPages(total, pageSize),
      section,
    });
  } catch (err: any) {
    console.error("Uncaught GET /api/admin/orders error:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdminSession();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = getSupabaseAdmin();
    if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

    let body: NewOrderInput;
    try {
      body = (await request.json()) as NewOrderInput;
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }

    // Server-side validation — this route is the real trust boundary now, not
    // just the form in AdminClient.tsx.
    const validationErr = validateNewOrder(body);
    if (validationErr) return NextResponse.json({ error: validationErr }, { status: 400 });

    const result = await insertNewOrder(body);
    if (result.error !== undefined) return NextResponse.json({ error: result.error }, { status: 500 });

    return NextResponse.json({ order: result.order });
  } catch (err: any) {
    console.error("Uncaught POST /api/admin/orders error:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}

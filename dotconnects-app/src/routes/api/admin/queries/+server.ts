import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requireStaff } from "$lib/server/guards";

/**
 * Business enquiries from the marketing site's form.
 *
 * The form writes to Supabase from carrier; this reads them back so the
 * team can work them without a second admin panel. Same database, one
 * place to look.
 *
 * Staff-level: answering enquiries is daily work.
 */
export const GET: RequestHandler = async ({ cookies, url }) => {
  const guard = await requireStaff(cookies);
  if (!guard.ok) return guard.response;

  const status = url.searchParams.get("status");
  const raw = Number(url.searchParams.get("limit"));
  const limit = Number.isFinite(raw) && raw > 0 ? Math.min(raw, 100) : 50;

  let q = guard.supabase
    .from("business_queries")
    .select("*", { count: "exact" })
    // Open first, then newest. That's the order the work happens in.
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status && ["open", "in_progress", "resolved", "spam"].includes(status)) {
    q = q.eq("status", status);
  }

  const counts = await Promise.all(
    ["open", "in_progress", "resolved", "spam"].map((s) =>
      guard.supabase
        .from("business_queries")
        .select("id", { count: "exact", head: true })
        .eq("status", s)
        .then((r) => [s, r.count ?? 0] as const),
    ),
  );

  const { data, error } = await q;
  if (error) return json({ error: error.message }, { status: 500 });

  return json({ queries: data ?? [], counts: Object.fromEntries(counts) });
};

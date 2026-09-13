import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Address an order by its row id OR its tracking id.
 *
 * The admin panel navigates by row id, so `/api/admin/orders/[id]/…`
 * was written against it. Order Central never learns that id: the push
 * response hands back `tracking_id` and `dropy_order_id` and nothing
 * else, so from DOC's side these endpoints were unaddressable — the
 * actions existed and could not be reached.
 *
 * Accepting both here beats storing DOT's row id in DOC. A stored id is
 * a second copy of an identifier that already exists, and it would only
 * help parcels pushed after the day it was added; every consignment
 * already in flight would stay unreachable.
 *
 * Numeric strings are row ids. Everything else is a tracking id, matched
 * case-insensitively, because a tracking id copied out of a WhatsApp
 * message arrives in whatever case the sender's keyboard produced.
 */
export function byOrderRef<T>(query: T, ref: string): T {
  const q = String(ref ?? "").trim();
  const anyQ = query as any;
  if (/^\d+$/.test(q)) return anyQ.eq("id", Number(q)) as T;
  /* ilike with no wildcards is case-insensitive equality. % and _ are
     escaped so a crafted ref cannot turn into match-everything. */
  return anyQ.ilike("tracking_id", q.replace(/[%_]/g, (c: string) => `\\${c}`)) as T;
}

/** Fetch one order by either reference. Null when there is no match. */
export async function findOrderByRef(
  supabase: SupabaseClient,
  ref: string,
  columns: string,
): Promise<any | null> {
  const { data } = await byOrderRef(
    supabase.from("dropy_orders").select(columns),
    ref,
  ).maybeSingle();
  return data ?? null;
}

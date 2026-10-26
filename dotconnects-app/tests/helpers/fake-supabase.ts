/**
 * A recording stand-in for the Supabase query builder.
 *
 * Every call on every chain is logged as [table, method, ...args], so a
 * test can assert both what a route asked for AND what it did not —
 * which is how "DOC's path makes no extra query" is proven rather than
 * assumed. `rows[table]` answers maybeSingle/single/await.
 */
export type Call = [string, string, ...unknown[]];

export function fakeSupabase(rows: Record<string, any> = {}, opts: { insertResult?: (t: string, v: any) => any } = {}) {
  const calls: Call[] = [];
  const from = (table: string) => {
    const result = () => {
      const r = rows[table];
      return typeof r === "function" ? r(calls) : r;
    };
    const q: any = {};
    for (const m of ["select", "eq", "neq", "is", "ilike", "like", "or", "order", "range", "gte", "lte", "limit", "in", "update", "delete", "insert"]) {
      q[m] = (...args: unknown[]) => {
        calls.push([table, m, ...args]);
        if (m === "insert" && opts.insertResult) q.__insert = opts.insertResult(table, args[0]);
        return q;
      };
    }
    q.maybeSingle = () => { calls.push([table, "maybeSingle"]); return Promise.resolve({ data: result() ?? null, error: null }); };
    q.single = () => {
      calls.push([table, "single"]);
      return Promise.resolve(q.__insert ?? { data: result() ?? null, error: null });
    };
    q.then = (ok: any, bad: any) => Promise.resolve({ data: result() ?? [], error: null, count: 0 }).then(ok, bad);
    return q;
  };
  return { client: { from } as any, calls };
}

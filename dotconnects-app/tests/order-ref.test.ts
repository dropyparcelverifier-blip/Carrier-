import { describe, it, expect } from "vitest";
import { byOrderRef } from "../src/lib/server/order-ref";

/* Order Central never learns DOT's row id — the push response returns
   tracking_id and dropy_order_id only. Without this these endpoints
   existed and were unreachable from the place the team actually works. */

function spyQuery() {
  const calls: any[] = [];
  const q: any = {
    eq: (col: string, val: any) => { calls.push(["eq", col, val]); return q; },
    ilike: (col: string, val: any) => { calls.push(["ilike", col, val]); return q; },
    calls,
  };
  return q;
}

describe("byOrderRef", () => {
  it("treats a numeric ref as the row id", () => {
    const q = spyQuery();
    byOrderRef(q, "42");
    expect(q.calls).toEqual([["eq", "id", 42]]);
  });

  it("treats anything else as a tracking id", () => {
    const q = spyQuery();
    byOrderRef(q, "RMTMTXZ5K4J5003404");
    expect(q.calls).toEqual([["ilike", "tracking_id", "RMTMTXZ5K4J5003404"]]);
  });

  it("matches a tracking id whatever case it was typed in", () => {
    const q = spyQuery();
    byOrderRef(q, "rmtmtxz5k4j5003404");
    // ilike without wildcards IS case-insensitive equality.
    expect(q.calls[0][0]).toBe("ilike");
  });

  it("trims surrounding whitespace", () => {
    const q = spyQuery();
    byOrderRef(q, "  RMT1  ");
    expect(q.calls).toEqual([["ilike", "tracking_id", "RMT1"]]);
  });

  it("neutralises wildcards so a ref can't match everything", () => {
    const q = spyQuery();
    byOrderRef(q, "%");
    expect(q.calls[0][2]).toBe("\\%");
    const q2 = spyQuery();
    byOrderRef(q2, "RMT_1");
    expect(q2.calls[0][2]).toBe("RMT\\_1");
  });
});

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { mapRow } from "$lib/server/shipment-service";
import { formatEtaIST } from "$lib/dates";

/* ═══════════════════════════════════════════════════
   The Indian courier's own delivery date.

   v11 added last_mile_edd and the handover route has been writing it
   since. Nothing read it: mapRow mapped the courier, the AWB and the
   tracking URL and dropped the date, and the customer page caught
   `forwarded` above its own headline branch — so a parcel handed to
   Velocity showed a pill where the date belongs while Velocity's own
   page showed 21 Sept. Both ends were built; the middle was not.
   ═══════════════════════════════════════════════════ */

const HANDED = {
  id: 9, tracking_id: "USLMU6TCM940605844", dropy_order_id: "Dropy-5481",
  customer_name: "Box Sensei", customer_mobile: "9876543210",
  customer_city: "Navi Mumbai",
  items: [{ name: "CeraVe Moisturising Cream", qty: 1, weight_kg: 0.54, price_usd: 18 }],
  total_weight_kg: 0.54, total_items: 1, declared_value_usd: 18,
  shipping_days: 12, shipping_mode: "Air Freight",
  current_stage: "handed_to_courier",
  route_key: null, timing_seed: 12345, status: "Forwarded to Courier", progress: 100,
  estimated_delivery: "03 Oct 2026", carrier_name: "", awb_number: null, admin_notes: null,
  last_mile_courier: "velocity", last_mile_awb: "7D140804346",
  last_mile_tracking_url: null,
  /* What Velocity quoted: midnight on the 21st, IST. */
  last_mile_edd: "2026-09-21T00:00:00+05:30",
  last_mile_original_edd: "2026-09-21T00:00:00+05:30",
  order_date: "2026-09-18T11:05:00.000Z",
  clock_anchor_stage: null, clock_anchor_at: null,
  label_generated_at: "2026-09-18T10:34:00.000Z",
  picked_up_at: "2026-09-18T10:35:00.000Z", delivered_at: null,
  dropy_order_events: [],
};

describe("mapRow carries the courier's date to the page", () => {
  it("maps last_mile_edd, which nothing did before", () => {
    /* The whole defect: the column was written on every handover and
       read by nobody. Break this line and the page silently loses the
       date again with every other test still green. */
    expect(mapRow(HANDED as any).lastMileEdd).toBe("21 Sept 2026");
  });

  it("reads the date in IST, not in the server's zone", () => {
    /* Vercel runs UTC. Midnight IST on the 21st is 18:30 UTC on the
       20th, so formatting the instant without a zone prints a date one
       day EARLIER than the courier's own page — a wrong promise that
       looks like a right one.

       Both sides are pinned to a zone. Asserting the UNZONED formatEta
       here instead would assert the machine: it answers 20 Sept on a
       UTC CI box and 21 Sept on a laptop in Mumbai, so the test would
       pass or fail on where it ran rather than on what the code does. */
    const at = new Date(HANDED.last_mile_edd);
    const inUtc = at.toLocaleDateString("en-GB", {
      day: "2-digit", month: "short", year: "numeric", timeZone: "UTC",
    });
    expect(formatEtaIST(at)).toBe("21 Sept 2026");
    expect(inUtc).toBe("20 Sept 2026");
    expect(formatEtaIST(at)).not.toBe(inUtc);
  });

  it("pins the formatter to the zone rather than to the machine", () => {
    /* The behaviour above cannot catch a removed timeZone on a laptop
       in Mumbai: with the zone deleted the local clock IS IST and every
       assertion still passes, while production — UTC on Vercel — is a
       day out. Asserting the source is deterministic wherever it runs,
       which is the whole point of a guard on this. */
    expect(readFileSync("src/lib/dates.ts", "utf8"))
      .toMatch(/export function formatEtaIST[\s\S]{0,240}timeZone: "Asia\/Kolkata"/);
  });

  it("is undefined when the courier gave no date", () => {
    /* Every row handed over before this shipped, and any courier that
       quotes a day count instead of a date. The page falls back to the
       card it drew before, rather than rendering an empty headline. */
    const out = mapRow({ ...HANDED, last_mile_edd: null } as any);
    expect(out.lastMileEdd).toBeUndefined();
  });

  it("is undefined rather than 'Invalid Date' on an unparseable value", () => {
    const out = mapRow({ ...HANDED, last_mile_edd: "not a date" } as any);
    expect(out.lastMileEdd).toBeUndefined();
  });

  it("still maps the courier and AWB beside it", () => {
    const out = mapRow(HANDED as any);
    expect(out.lastMileCourier).toBe("velocity");
    expect(out.lastMileAwb).toBe("7D140804346");
  });
});

describe("the customer card leads with it", () => {
  const PAGE = readFileSync("src/routes/+page.svelte", "utf8");

  it("puts the courier-date branch ABOVE the bare forwarded branch", () => {
    /* Branch ORDER is the bug. `{:else if forwarded}` matched first, so
       `{:else if headline}` was unreachable for exactly the parcels that
       now had the better date. */
    const withDate = PAGE.indexOf("{:else if forwarded && lastMileParts}");
    const bare = PAGE.indexOf("{:else if forwarded}");
    expect(withDate).toBeGreaterThan(-1);
    expect(bare).toBeGreaterThan(-1);
    expect(withDate).toBeLessThan(bare);
  });

  it("prefers the courier's date over ours in the headline", () => {
    expect(PAGE).toMatch(/headline = \$derived\(lastMileParts \?\? doorstepParts \?\? etaParts\)/);
  });

  it("labels it as arriving at the address, not as a handover", () => {
    expect(PAGE).toMatch(/\{:else if forwarded && lastMileParts\}Arriving at your address/);
  });

  it("no longer claims out for delivery", () => {
    /* Velocity read READY FOR PICKUP while the card said OUT FOR
       DELIVERY. A customer waits by the door on that. */
    expect(PAGE).not.toMatch(/pill ok">Out for delivery/);
    expect(PAGE).toMatch(/pill ok">With courier/);
  });
});

describe("the shareable link keeps the phone", () => {
  const TRK = readFileSync("src/routes/tracking/[id]/+page.svelte", "utf8");

  it("carries ?phone= through the redirect instead of dropping it", () => {
    /* DOC builds internal links with the phone already on them. This
       route rebuilt the URL from the id alone, so the phone was thrown
       away in the redirect and the gate opened empty — indistinguishable
       from never having appended it. */
    expect(TRK).toMatch(/searchParams\.get\("phone"\)/);
    expect(TRK).toMatch(/&phone=\$\{phone\}/);
    expect(TRK).toMatch(/goto\(target/);
  });

  it("only forwards a real ten-digit number", () => {
    expect(TRK).toMatch(/\^\\d\{10\}\$/);
  });
});

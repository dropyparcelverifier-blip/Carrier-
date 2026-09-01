# Apply — US routes only, ending at Mumbai

Extract INTO `DotConnects Logistics`. Overwrite.

    cd dotconnects-app
    npm install
    npx svelte-kit sync
    npx tsc --noEmit ; npx vitest run ; npx vite build     # 382 tests

## Push

    cd ..
    git add -A
    git commit -m "US-only route generation, 57 routes all ending at Mumbai; purge remaining Dropy strings"
    git push origin main

---

# The bug you spotted

`Dropy-2778` shipped from a **New York** warehouse and its timeline read:

    21 Aug  Left origin warehouse   DotConnects Logistics Warehouse, New York, NY
    22 Aug  At departure gateway    MEL          <- Melbourne
    25 Aug  Departed origin         MEL -> DXB

New York to Melbourne to Dubai to Chennai. `pickOrderRoute()` chose at random
from all 55 routes regardless of where the parcel actually started — so roughly
**80% of orders showed a gateway the parcel had never been near.**

# 57 US routes, `US12DONE` … `US25DTHREE`

Eight at twelve days, three or four for each of thirteen through twenty-five.
All depart a US gateway: EWR, JFK, ORD, LAX, SFO, IAD, BOS, ATL.

**Every route ends at the Mumbai warehouse.** 42 of the 57 enter India
somewhere else — Delhi, Bengaluru or Chennai — then move domestically to Navi
Mumbai. That leg is where the extra days on the longer routes actually go,
which is both true and a better explanation than "a slower aircraft".

Those routes read `Bengaluru, India — cleared for onward movement` at the
customs-cleared stage, rather than pretending Bengaluru was the destination.

**Only four are non-stop:** `EWR→BOM`, `JFK→BOM` and `EWR→DEL` on Air India,
`EWR→DEL` on United. Those are the genuine US–India non-stops. Everything else
routes via Dubai, Doha, London, Frankfurt, Istanbul or Amsterdam.

## The other 55 are kept, not deleted

`ACTIVE_ROUTES` filters on the `US` prefix, and `pickOrderRoute()` draws only
from that. The UK, Korea, Japan and Australia routes stay defined so those
lanes can be switched on by changing one constant — but nothing assigns them
to a real order today.

`pickOrderRoute()` deliberately does **not** fall back to the full list. An
empty `ACTIVE_ROUTES` should fail loudly, not quietly resume putting Melbourne
departures on Newark parcels.

# The Dropy strings you spotted

`Dropy Warehouse, New York, NY` was on the live timeline at "Verified at
origin". It was in `admin-stages.ts` and `order-routes.ts` — files my earlier
sweep didn't cover.

Also purged from `routes.ts` (66 references), `demo-data.ts` (13),
`shipment-service.ts` (7) and `last-mile.ts`. **`demo-data.ts` mattered most:
it's the fallback shown when Supabase is unreachable, so those strings could
reach a customer's screen.**

What remains is the `dropy_orders` table name and comments explaining the
`Dropy-3141` order format — both correct, since that IS your order numbering.

# Tests: 382

New coverage: only US routes active, non-US kept but excluded, every active
route departs a US gateway, and **every active route ends at Navi Mumbai**.

---

# Still open

- Ocean route — 16 stages, designed, not built
- The eight US gateways and non-Air-India carriers still need confirming
  against what your cargo actually books

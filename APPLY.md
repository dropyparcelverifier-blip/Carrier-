# Apply — DotConnects stages + courier forwarding

Extract INTO `DotConnects Logistics`. Overwrite.

**Delete this file if it exists** — a zip can't express a deletion, and it
was an over-engineered state that's been removed:

    del dotconnects-app\src\lib\server\record-label.ts

Then:

    cd dotconnects-app
    npm install
    npx svelte-kit sync
    npx tsc --noEmit ; npx vitest run ; npx vite build     # 348 tests

    cd ..
    git add -A
    git commit -m "Stages: 55 routes, short codes, two-line timeline; forward on any courier record"
    git push origin main

---

# How forwarding works now

**Nobody on the warehouse team touches this app.** The courier is the only
sensor. The moment a shipment exists in Shiprocket, there is a real AWB, the
consignment has left our hands, and everything after that lives on their page.

    Shiprocket reports ANY of these
        awb assigned · label generated · manifest generated · ready to ship
        new · invoiced · pickup generated · pickup scheduled · pickup error
        pickup rescheduled · picked up · shipped · in transit
        out for delivery · delivered
              ↓
    stage jumps straight to "Forwarded to Courier"
    from wherever the clock had it
              ↓
    courier name + AWB + tracking link shown to the customer
              ↓
    computeOverdue sees a real event — never marked late

**A generated AWB is the forwarding.** I first split label from pickup and
showed "booked, awaiting collection" in between — a distinction this app has no
business making. Removed.

**A failed pickup still counts.** The AWB is valid and the customer can follow
it; whether the van turned up is the courier's own page to show.

**The status list covers the whole lifecycle** so an out-of-order or retried
webhook still forwards correctly. If pickup lands before the label event, or
"delivered" arrives first, it works.

# ⚠️ Velocity is a blind spot

`courier-updates-b` **captures the payload and stops.** It never advances
anything.

So an order shipped through Velocity gets no `label_generated_at` and no
`picked_up_at` — the clock runs out, the page says "running late", and it stays
there indefinitely while the parcel is delivered.

Shiprocket is fully wired. **Velocity needs one real captured payload** to build
the parser against; the field names and status strings can't be guessed.

Check `captured_velocity_webhooks` — if anything has landed there, send me a row
and I'll write it.

# The stage work

**Two-line timeline.** Activity, then a coded location. The phase tag is gone.

    20 Aug   Departed origin
    00:50    [FLT] EWR → BOM · Air India

**55 routes**, `12DONE` … `25DTHREE`. Eight at twelve days, three or four for
each of thirteen through twenty-five. Two routes of the same length are
different shapes — customs holds account for the difference on the long ones,
not slower aircraft.

**Geography checked.** Four routes in my first draft claimed non-stops that
don't exist (EWR→BLR, JFK→MAA, ANA on Narita–Mumbai, Air India from Sydney).
All now route through a real hub. A regression test pins it.

**A bug the tests caught:** my first profile set put `qc_check` at 0.96 instead
of 1.0, which silently redefined what the promised date means and threw the
clock 25 hours out. `tsc` and the build both stayed green;
`m3-stage-clock.test.ts` did not.

# Tests: 348

---

# Still to confirm

Gateways `LAX` `ORD` `MAN` `KIX` `MEL` and carriers `SQ` `QF` `QR` `BA` aren't
in `lib/network.ts` — I chose them to fill the permutations, and each renders on
a customer's page. `BOM3` is likewise an invented warehouse code.

# Not built

- **Ocean route** — 16 stages, designed, needs new stage keys
- **`HLD` / `RTO` exception stages** — designed, need admin controls

# Apply — batch 2

Extract INTO `DotConnects Logistics`. Overwrite.

    cd carrier
    npm install
    npx tsc --noEmit ; npx vitest run ; npx next build     # 52 tests, 19 routes

    cd ..
    git add -A
    git commit -m "Carrier batch 2: cards, quote rebuild, purge Dropy and WhatsApp"
    git push origin main

---

# Zero traces

    Dropy          0
    dropy          0
    9867996311     0
    WhatsApp       0
    prohibited-items  0

**`lib/routes.ts` alone had 89.** It feeds `demo-data.ts`, which feeds
`CustomsScreenshot`, which renders on the homepage — so "Dropy Warehouse, Vashi,
Navi Mumbai" and "dropy.in" were one View Source away from any visitor. Also
cleaned: the `Dropy.in` client entry, both test fixtures, and the WhatsApp
copy in privacy, about, the FAQ and the enquiry form.

# Homepage

**"How it moves" is in a card again.** The card had been deliberately removed —
there's a comment explaining it sat in a run of five back-to-back bordered
cards that read as one repeated component. That run no longer exists: Reviews
is gone, the FAQ is a card grid, the hero lost a card. What was left was a
timeline floating on the canvas, which is the "flying in the sky" you described.

**"Who carries it" got the same card.** It sits directly below How it moves;
one carded and one loose reads as a mistake rather than a rhythm.

**"What we move" heading is centred**, matching the card grid beneath it.

# About

**Section headings centred.** Four of them were left-aligned above full-width
card grids, so the right half of a 1440px screen sat empty while the cards below
filled it. `SectionHeading` already had `align="center"` — it just wasn't used.

**Clients section removed entirely.** Not replaced this time — the same ground
is covered by the "who we move for" copy higher up, so it was redundant as well
as risky.

# Quote page — rebuilt

**Product category is gone**, and with it the per-category rate table.

## How the calculation works now

    chargeable weight = the GREATEST of:
        actual weight
        volumetric weight  =  (L × W × H in cm) ÷ 5000
        minimum            =  5 kg

    ...rounded up to the next half kilo

    freight  =  chargeable kg × ₹450
    total    =  freight + ₹2,900 handling

**Worked example — 12 kg, box 60 × 40 × 50 cm, from the US**

    volumetric   = (60 × 40 × 50) ÷ 5000  =  24 kg
    actual       = 12 kg
    minimum      = 5 kg
    chargeable   = 24 kg          ← volumetric wins, it's a light bulky box

    freight      = 24 × 450       =  ₹10,800
    handling     =                =  ₹ 2,900
    total                            ₹13,700

**A second example — 12 kg, box 30 × 25 × 20 cm**

    volumetric   = 15,000 ÷ 5000  =  3 kg
    chargeable   = 12 kg          ← actual wins, it's a dense box
    total        = 12 × 450 + 2900  =  ₹8,300

Same weight, half the price, because the second box doesn't waste aircraft
space. That's how air freight actually prices, and it's what the existing FAQ
entry on "chargeable weight" was already describing.

## Minimum weight

**5 kg**, up from 1 kg. At 1 kg a single carton priced at ₹3,350 — less than
the documentation and customs filing cost to produce.

This does **not** contradict "one carton minimum" on the homepage. You accept
one carton; it's billed at the 5 kg floor. The form says so under the weight
field.

## ⚠️ Two numbers you must confirm

`RATE_PER_KG = 450` and `BASE_HANDLING_INR = 2900` were **invented** alongside
the eleven fabricated statistics. They've never been checked against a real
invoice. Both carry a warning comment in `lib/quote.ts`.

**Get the real figures from the cargo before this goes live.** A quote engine
that under-prices is worse than no quote engine.

## Tests

52 now, up from 49. The old suite pinned per-category rates and a 1 kg minimum,
both gone. The new ones cover volumetric-vs-actual, the 5 kg floor, half-kilo
rounding, and the IATA divisor.

---

# Batch 3 — still to do

- Quote: remove the "Calculation" slide from How it works
- Quote: "Operators we book" — uneven column heights
- Contact: response-time card has no image
- Mobile responsiveness pass across all pages

# ShipmentDetail — behaviour inventory

**Purpose:** written before touching the customer view (POA tasks 7.2 and 7.10, R1
mitigation). Source: `components/ShipmentDetail.tsx`, 781 lines.

---

## 1. Hero band

| # | Behaviour |
|---|---|
| 1.1 | Personalised greeting via `orderGreeting(shipment, etaRelative)` |
| 1.2 | ETA leads the page in the largest type — "the actual answer to where's my stuff" |
| 1.3 | Relative ETA ("in 4 days") with the absolute date beneath it |
| 1.4 | Ambient aurora glow tinted by status colour; exactly one on the page |
| 1.5 | Coloured top rule matching status |
| 1.6 | Tracking ID is click-to-copy, with a 2s tick confirmation |
| 1.7 | Order reference shown alongside |
| 1.8 | `StatusPill` with courier |
| 1.9 | Consignee name with a package glyph |

## 2. Status-specific hero states

| # | State | Shows |
|---|---|---|
| 2.1 | `Forwarded to Courier` | "Handed off to courier" + the real handover timestamp |
| 2.2 | …with a tracking URL | "Delivery ETA on {courier}" link |
| 2.3 | …without one | "Complete" |
| 2.4 | `At Warehouse` | "At Dropy Vashi warehouse" + that event's timestamp |
| 2.5 | `Received` | "QC check — done" + the QC timestamp |
| 2.6 | Everything else | "Est. arrival at our Vashi hub" + ETA |

**2.4 and 2.5 exist deliberately** — three distinct real sub-stages at Vashi, not one
merged "arrived", each with its own label and real timestamp.

## 3. Route bar

| # | Behaviour |
|---|---|
| 3.1 | `RouteBar` — origin → destination with progress |
| 3.2 | Mode icon: Plane / Ship / Truck by shipping mode |

## 4. Timeline

| # | Behaviour |
|---|---|
| 4.1 | **Newest first** — matches how Shiprocket and Velocity's own pages read |
| 4.2 | **Only stages that have happened** (`state !== "pending"`) |
| 4.3 | One "— next" preview row after the current stage |
| 4.4 | Preview suppressed when delivered |
| 4.5 | Preview suppressed mid-exception — an unresolved problem shouldn't imply a normal next step |
| 4.6 | Rows grouped into named phases: "a flat 12-row log reads as a log; a handful of named chapters reads as a story" |
| 4.7 | Per-stage icons (`STAGE_ICON`) |

## 5. Details accordion

| # | Behaviour |
|---|---|
| 5.1 | Collapsed by default |
| 5.2 | Icon-led single-column rows, "like a manifest, not N identical boxes" |
| 5.3 | Facts: customer, mode, carrier, item count, weight, declared value in INR |
| 5.4 | AWB row only when present and not `—` |
| 5.5 | Last-mile courier + AWB row only when both present |

## 6. Support footer

| # | Behaviour |
|---|---|
| 6.1 | "Question about this shipment?" + 4-business-hour response promise |
| 6.2 | `mailto:` support link |

## 7. Deliberate omissions already in place

Removed by a previous author with reasons in the code. **Do not reinstate.**

| # | Removed | Reason given |
|---|---|---|
| 7.1 | Per-item product list | Naming products reads as unauthorised brand disclosure |
| 7.2 | Brand chips ("CeraVe", "Wavytalk") | Reads as an official brand association |
| 7.3 | Outer wrapping card | "The generic dashboard tell no amount of internal polish fixes" |

## 8. Accessibility / motion

| # | Behaviour |
|---|---|
| 8.1 | `useReducedMotion()` respected on the hero animation |
| 8.2 | `aria-hidden` on decorative glow and rules |
| 8.3 | 44px minimum tap targets (`min-h-11`) on the accordion and support button |

## 9. Mobile handling already present

`sm:` breakpoints throughout · `truncate` on fact values · `min-w-0` on flex children ·
`shrink-0` on icons · `flex-wrap` on the meta row · single-column below `sm`.

---

## Gaps against the current spec

| # | Gap | Source |
|---|---|---|
| G1 | Shows one "— next" preview row | **D6 says no future stages at all** |
| G2 | No overdue state — `eta` is now `""` when overdue (M3), so the hero renders an empty date with no explanation | Architecture §6 |
| G3 | No damaged state, no forward link to a replacement | Gate 5 redispatch flow |
| G4 | Doesn't use `isOverdue` from the payload | M3 |

---

## Post-rebuild walkthrough (task 7.10)

Rebuild chosen at Gate 5 after the assessment below. Every row above was
carried across. Verified by reading the rebuilt file:

| Section | Status |
|---|---|
| §1 Hero band (1.1–1.9) | ✅ All nine preserved |
| §2 Status states (2.1–2.6) | ✅ Plus two new: overdue, damaged |
| §3 Route bar | ✅ Same component, now stacks below 640px (guardrail 5) |
| §4 Timeline (4.1–4.7) | ✅ 4.3–4.5 removed by D6 — see G1 |
| §5 Details (5.1–5.5) | ✅ Now an always-open card, no longer an accordion |
| §6 Support footer | ✅ Now the "Need help?" card, expanded as requested |
| §7 Deliberate omissions | ✅ Products and brand chips still absent. §7.3 (no outer card) **overridden** — cards are the Gate 5 choice |
| §8 Accessibility | ✅ Reduced motion, aria-hidden, 44px targets all kept |

**Two changes worth calling out:**

- **§5 is no longer collapsed.** It was a `<details>` accordion; it is now an
  open card, matching "all expanded".
- **§7.3 is deliberately reversed.** The previous author removed the outer card as
  "the generic dashboard tell". Cards are back by explicit product decision, under
  the six guardrails in `docs/05-design.md` §3b — because card padding is exactly
  what causes the clipping cards are prone to.

**One structural fix found during the rebuild:** `RouteBar` carried its own card
wrapper. Nesting it inside `CardSection` would have paid the padding twice — the
exact horizontal squeeze guardrail 2 exists to prevent. Its wrapper was removed;
it has no other consumers.

---

## Assessment

**This component does not need rebuilding.** It is carefully built, mobile-aware
throughout, and carries several deliberate design decisions with reasons recorded in
the code.

POA task 7.3 says "rebuild mobile-first". That was written when the assumption was a
screen with real overflow defects. No specific defect has been identified, and reading
the source, the mobile handling is already thorough.

Rebuilding 781 lines of considered work to fix four named gaps risks losing quality
rather than gaining it — sections 1–8 above are all things a rebuild could silently
drop.

**Recommendation: close G1–G4 as targeted changes, verify at 360 px, and treat the
card-sections layout (C2 Option B) as a separate decision.** See the note in the
handover for why that one is worth pausing on.

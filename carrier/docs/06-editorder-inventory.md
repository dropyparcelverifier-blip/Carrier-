# EditOrder — behaviour inventory

**Purpose:** written before rebuilding, walked after (POA tasks 6.1 and 6.8, R1
mitigation). Every line here is something the current screen does. If the rebuild
drops one, it must be a deliberate decision recorded below — not an accident.

Source: `components/AdminClient.tsx`, `function EditOrder` (~line 667–930).

---

## 1. Data it loads

| # | Behaviour | Notes |
|---|---|---|
| 1.1 | Fetches event history from `GET /api/admin/orders/[id]` on mount | `credentials: "include"` |
| 1.2 | Surfaces a load error inline rather than failing silently | `Couldn't load event history (status)` |
| 1.3 | Parses `items` from either a JSON string or an array | The column has been both |

## 2. Stage handling

| # | Behaviour | Notes |
|---|---|---|
| 2.1 | Pre-selects the **clock-suggested** stage, not the stored one | `suggestStage(created_at, shipping_days)` |
| 2.2 | Flags when the suggestion differs from stored (`autoSuggested`) | Tells the operator the clock has moved on |
| 2.3 | Offers delay reasons **filtered to the current stage** | `delayReasonsForStage()` — no "Customs hold" for a parcel still in the US |
| 2.4 | Blocks saving `exception` + reason `Other` with an empty note | A bare "Other" tells a customer nothing |
| 2.5 | Composes the note as `"<reason> — <note>"` for exceptions | Plain note otherwise |
| 2.6 | `isFinal` when stage is `handed_to_courier` | Journey over |
| 2.7 | `awaitingHandover` when stage is `qc_check` | Keeps the form open so courier/AWB can be entered — that entry is what advances it |

## 3. Editable fields

| # | Field | Notes |
|---|---|---|
| 3.1 | Stage | dropdown |
| 3.2 | Note | free text |
| 3.3 | Delay reason | only when stage is `exception` |
| 3.4 | Payment status | defaults `Unpaid` |
| 3.5 | Shipping days | defaults 10, coerced to a number on save |
| 3.6 | Admin notes | internal only — never in the public payload (M1) |
| 3.7 | Last-mile courier | Shiprocket / Velocity |
| 3.8 | Last-mile AWB | trimmed; entering courier **and** AWB is what triggers handover |

## 4. Actions

| # | Behaviour | Notes |
|---|---|---|
| 4.1 | Save → `PATCH /api/admin/orders/[id]` | |
| 4.2 | Success message, then `onSave()` after 800ms | Deliberate pause so the message is readable |
| 4.3 | Delete is two-step (`confirmingDelete`) | Now soft delete + admin-only (M2) |
| 4.4 | Copy customer tracking link to clipboard | `/track?id=…&phone=…`, 2s "Link copied" confirmation |

## 5. Display

| # | Behaviour | Notes |
|---|---|---|
| 5.1 | Tracking ID as the headline | mono |
| 5.2 | Dropy order ID + US order ID beneath | |
| 5.3 | Items list | |
| 5.4 | Event history timeline | from 1.1 |
| 5.5 | Last-mile tracking URL when resolvable | `courierTrackingUrl()` |
| 5.6 | Inline error and success banners | |

---

## Deliberate changes in the rebuild

Recorded so a dropped behaviour is a decision, not a regression.

| # | Change | Reason |
|---|---|---|
| A | **2.1 reversed** — show the *stored* stage as current, the clock-derived one as the next predicted step | The old screen pre-selected a stage the operator hadn't chosen, so hitting Save silently committed the clock's guess as if it were a human decision. With M3's anchor, a manual move is a real recorded event and shouldn't be pre-filled. |
| B | **Stage moves leave PATCH** and use `POST /[id]/stage` | Writes `clock_anchor_*` so the remaining schedule re-scales (§4 Case 1). PATCH can't do that. |
| C | **US order ID hidden** | Your requirement #2. Admin can still see it via the audit log. |
| D | **Delete hidden for staff** | M2 role gating. Server rejects it regardless. |
| E | **Added:** greyed future stages with predicted dates | Wireframe A3, admin-only |
| F | **Added:** milestone controls (label / picked / delivered) | The webhook fallback — without it Velocity orders strand at QC |
| G | **Added:** damaged + redispatch | Gate 5 flow |
| H | **Added:** per-order audit trail | Task 6.7 |
| I | **Kept 2.3, 2.4, 2.5 exactly** | Stage-filtered delay reasons and the empty-note guard are good behaviour that took real thought — carried across unchanged |

## Not changing

3.4–3.8, 4.4, 5.1–5.6 all carry over as-is.

---

## Verification (task 6.8)

Walk every numbered row above against the rebuilt screen. Anything missing that isn't
in the "deliberate changes" table is a regression.

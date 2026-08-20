# Dropy Order Central → dropy-final bridge API

This is the complete contract for pushing data from **Dropy Order Central**
(the Flask/SQLite app) into **dropy-final** (this repo, "DotConnects Logistics" —
the customer-facing US→Vashi tracker). Everything Order Central needs to
call lives here. Two endpoints:

1. `POST /api/admin/orders/from-order-central` — create the Dropy shipment(s)
   for an order once it's marked `us_dispatched`.
2. `POST /api/admin/orders/from-order-central/add-days` — add extra shipping
   days to an already-created shipment when it's delayed.

## Auth

Both endpoints check a shared secret, **not** a login/cookie (Order Central
is a server-to-server caller, not a browser).

```
X-Bridge-Secret: <value of ORDER_CENTRAL_BRIDGE_SECRET>
```

The secret lives in dropy-final's `.env.local` as `ORDER_CENTRAL_BRIDGE_SECRET`
and must be copied byte-for-byte into Order Central's own `.env` as
`DROPY_FINAL_BRIDGE_SECRET`. Rotate both sides together if it's ever exposed.
A missing/wrong header returns `401 {"error":"Unauthorized"}`.

## Base URL

- Local dev: `http://localhost:3000`
- Production: the deployed Vercel URL (set `DROPY_FINAL_BRIDGE_URL` in Order
  Central's `.env` to whichever one is live).

---

## 1. Create shipment(s) — `POST /api/admin/orders/from-order-central`

Call this once, when an employee sends a `us_dispatched` order to Sagar
Exports. **One customer order can become multiple dropy_orders rows** —
one per US order ID / Amazon order that ships separately from the US
warehouse, because each leg gets its own Dropy tracking ID and its own
independent progress through customs etc. That's what `legs` is for.

### Request body

```jsonc
{
  "dropy_order_id": "DROPY-3177",       // grouping id — see note below
  "customer_name": "vivek pingili",
  "customer_mobile": "9059693726",       // exactly 10 digits
  "customer_email": "pingili@mac.com",   // optional
  "customer_address": "1-3-34/5 Madhuvan Enclave...", // optional
  "customer_city": "Hyderabad",
  "customer_pincode": "500007",          // optional
  "shipping_mode": "Air Freight",        // optional, one of:
                                          //   "Air Freight" | "Express Air" | "Ocean Freight"
                                          // defaults to "Air Freight"
  "payment_status": "Cash on Delivery",  // optional, one of:
                                          //   "Unpaid" | "Partially Paid" | "Fully Paid" |
                                          //   "Cash on Delivery" | "Refunded"
                                          // defaults to "Unpaid"
  "admin_notes": "From Order Central — order #Dropy-3177", // optional, freeform

  "legs": [
    {
      "us_order_id": "114-2606071-9123401",   // format: NNN-NNNNNNN-NNNNNNN
      "shipping_days": 9,                      // 1-30, the days THIS leg needs
      "items": [
        { "name": "Vanicream Moisturizing Skin Cream ... 16 Ounces",
          "qty": 1, "weight_g": 500, "sku": "B000NWGCZ2" }
      ]
    },
    {
      "us_order_id": "114-6418828-5370646",
      "shipping_days": 9,
      "items": [
        { "name": "Vanicream Moisturizing Lotion ... 16 Ounce Pack Of 1",
          "qty": 2, "weight_g": 500, "sku": "B003XWG880" },
        { "name": "Vanicream Enhanced Moisturizer 12 Fluid Ounce ...",
          "qty": 1, "weight_g": 400, "sku": "B0GFP8SRX6" }
      ]
    }
  ]
}
```

**Important — items must be split per leg.** Each `legs[].items` should
contain ONLY the products actually shipping under that US order ID, not the
customer's full basket. dropy-final does not know (and cannot guess) which
Amazon order covers which product — that split has to come from Order
Central, since that's where the Amazon purchases actually happen.

`items[].weight_g` and `.sku` are optional (`weight_g` defaults to 100 if
omitted); `name` and `qty` are required.

### `dropy_order_id` grouping / uniqueness

`dropy_order_id` has a unique constraint in the database. To keep multiple
legs of the same customer order visually grouped without violating that:

- 1 leg → the id is used as-is: `DROPY-3177`
- 2+ legs → each leg gets a `-N` suffix: `DROPY-3177-1`, `DROPY-3177-2`, ...

You only need to send the base id (`DROPY-3177`) once per call — the
endpoint appends the suffix itself when `legs.length > 1`.

### Response

`200 OK`:
```jsonc
{
  "orders": [ /* one dropy_orders row per successfully created leg, incl. its tracking_id */ ],
  "errors": [ /* present only if some legs failed — see below */ ]
}
```

Each created order object includes `tracking_id` (e.g. `TRKMSZRLRMI0646`) —
**save this per leg**. You'll need it later to call the add-days endpoint if
that specific leg gets delayed.

Partial failure: if some legs are valid and others aren't (e.g. a bad US
order ID format), the valid ones are still created — check `errors` for
which `us_order_id`s failed and why:
```jsonc
{ "orders": [...], "errors": [{ "us_order_id": "114-...", "error": "..." }] }
```

Total failure (`400`):
```jsonc
{ "error": "No orders created.", "errors": [...] }
```

### Validation (per leg)

- `customer_name` — required, non-empty
- `customer_mobile` — required, exactly 10 digits
- `customer_city` — required, non-empty
- `us_order_id` — required, format `NNN-NNNNNNN-NNNNNNN` (e.g. `114-2606071-9123401`)
- `items` — at least one item with a non-empty `name`
- `shipping_days` — 1-30

---

## 2. Add delay days — `POST /api/admin/orders/from-order-central/add-days`

Call this when a specific leg (one tracking_id) is running late and needs
more shipping days — e.g. a customs hold on one Amazon order while its
sibling leg on the same customer order is on schedule. This is why delays
are tracked **per tracking_id, not per customer order**: each leg can slip
independently.

### Request body

```jsonc
{
  "tracking_id": "TRKMSZRLRMI0646",  // from the create-shipment response
  "extra_days": 3,                    // 1-30, ADDED to the current shipping_days
  "reason": "Customs hold at BOM"     // optional, freeform, appended to admin_notes
}
```

This is **additive** — `extra_days` gets added to whatever `shipping_days`
the order currently has, not a replacement value. Call it again if the same
leg slips further; each call adds on top of the last. The combined total is
capped at 30 days.

### Response

`200 OK`:
```jsonc
{ "ok": true, "tracking_id": "TRKMSZRLRMI0646", "shipping_days": 12, "estimated_delivery": "05 Sept 2026" }
```

`404` if no order exists with that `tracking_id`. `400` if `extra_days` is
missing/out of range.

---

## Notes for the Order Central side

- Neither endpoint changes anything in Order Central's own SQLite DB or
  Shopify sync — they're pure outbound calls. Order Central owns logging
  the result locally (e.g. a stage_log note) however makes sense there.
- Network/auth errors (wrong secret, dropy-final unreachable, Supabase down)
  come back as a non-2xx status with `{"error": "..."}]` — surface that
  message to the employee rather than retrying silently.
- `POST /api/admin/orders/from-order-central` is idempotent in the sense
  that calling it twice for the same order creates TWO separate shipments —
  there's no dedup by `us_order_id`. Only call it once per leg per order;
  if a resend is genuinely needed, that's a manual decision, not automatic.

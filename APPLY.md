# Apply — Velocity matching fixed from the real payload

Extract INTO `DotConnects Logistics`. Overwrite.

    cd dotconnects-app
    npm install
    npx svelte-kit sync
    npx tsc --noEmit ; npx vitest run ; npx vite build     # 378 tests

## Push

    cd ..
    git add -A
    git commit -m "Velocity: match on order_display_id with # stripped — real payload differs from docs"
    git push origin main

Vercel redeploys automatically.

---

# The bug that one captured row exposed

    Velocity sends   order_display_id: "#Dropy-1855"
    Database holds   dropy_order_id:    "Dropy-1855"
    Filter built     dropy_order_id.eq.#Dropy-1855
    Result           NO MATCH

**Every Velocity webhook would have found no order.** The parser would have
run, logged "no matching order", and moved on — silently, forever.

## Three ways the real payload differs from the docs

| Docs | Reality |
|---|---|
| `order_external_id` is your reference | It's **Shopify's** order id (`5931361599568`) |
| `order_display_id: "114595804897851"` | `"#Dropy-1855"` — **with a `#`** |
| `shipment_type: "forward"` | **Absent entirely** |
| `event: "status_change"` | `"tracking_addition"` |
| `event_timestamp` | `webhook_sent_at` |
| — | `new_tracking { location, remarks, tracking_id }` — undocumented |

`order_display_id` is now tried **first**, with the `#` stripped.
`order_external_id` is kept as a fallback in case the Shopify id is ever
stored against a consignment.

`shipment_type` defaulting to `"forward"` is now a deliberate, commented
decision rather than an accident of `??`. It's safe: return and RTO statuses
are excluded from `FORWARDED_STATUSES`, so a mislabelled return can only reach
the logging path.

`new_tracking.location` — `"Mumbai_ShastriNagar_D (Maharashtra)"` — now
appears in the admin audit note. Undocumented, and the most useful field in the
payload for anyone chasing a parcel.

Seven new tests run against the captured payload verbatim.

---

# ⚠️ Two things that need you

## Velocity is pointed at a dead URL

The captured headers show:

    host:            carrier-ashy.vercel.app
    x-matched-path:  /api/webhooks/velocity

That's the **carrier** project, at a route we deleted. Which is why there's
exactly one captured row, from 20 August, and nothing since.

Repoint it — Velocity panel → Settings → Webhooks:

    https://dotconnect-seven.vercel.app/api/webhooks/courier-updates-b

## The API key in that panel is now in our chat

The captured headers included the live `x-api-key` value Velocity is
configured with. It's in this conversation's history.

**Generate a new one, set it in both places:**

    node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

    Velocity panel  →  Settings → Webhooks → API Key
    Vercel          →  VELOCITY_WEBHOOK_SECRET  (then redeploy)

Until `VELOCITY_WEBHOOK_SECRET` is set, the auth check is **skipped entirely** —
the endpoint accepts anything.

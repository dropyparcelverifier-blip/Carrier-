# DotConnects App — SvelteKit

Customer tracking, admin panel and all API routes.
The marketing site stays on Next.js in the `carrier` repo.

    dotconnects.in          → Next.js  (marketing, quote, legal)
    track.dotconnects.in    → this app (tracking, admin, API)

One domain, two Vercel projects, two DNS records. Subdomains are free.

## Setup

    npm install
    copy .env.example .env
    # fill in PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the
    # SAME Supabase project the Next.js app uses — no data migration needed
    npm run dev

Dev server binds to every interface, so a phone on the same wifi can reach
it at http://<your-lan-ip>:5173 with no extra flags.

## Verify

    npx tsc --noEmit      # must print nothing
    npm test              # 21 files, 329 tests
    npm run build         # must say "✓ built"

## Layout

    src/lib/              client-safe. Pure logic, no framework imports.
      stage-clock.ts        clock re-anchoring, Case 2 compression, overdue
      order-routes.ts       route tables, stage timing
      order-sections.ts     admin table section vocabulary
      tracking-id.ts        RMT/USL generator + prefix inheritance
      types.ts              STAGES, Shipment, AdminOrder
      components/           .svelte components
      styles/tokens.css     design tokens, copied from the Next app

    src/lib/server/       SERVER ONLY — SvelteKit enforces this at build
      supabase-admin.ts     service-role client
      admin-session.ts      HMAC cookie + role lookup
      audit.ts              audit log writer
      shipment-service.ts   the public tracking query
      status-payload.ts     DOC status API shape
      create-order.ts       insert + collision retry

    src/routes/           pages and endpoints
    tests/                the 329 tests, moved verbatim

## Why $lib/server matters

Anything under `src/lib/server` cannot be imported by client-reachable
code — SvelteKit fails the build. The Next.js version relied on a naming
convention and a comment to keep the service-role key off the browser.
This is the same protection enforced by the compiler.

## Port notes

Almost everything moved unchanged. Two files needed real rewrites:

**`admin-session.ts`** — Next read cookies from an ambient `cookies()`
call available anywhere. SvelteKit passes a `Cookies` object on the
request event, so it's now a parameter. Better shape: the dependency is
visible in the signature instead of being ambient.

**`supabase-admin.ts`** — `process.env` → `$env/dynamic/private`, and the
client is built on first use so a credential-less build machine doesn't
fail the build.

Everything else was a path rewrite: `@/lib/x` → `$lib/x`.


---

## Port status — COMPLETE

Every route and page from the Next.js app is ported. 20 API routes, 3 pages,
329 tests, 0 typecheck errors, 0 svelte-check warnings.

| Route | |
|---|---|
| `/` | Customer tracking — C1 search + C2 cards |
| `/admin` | Orders table — 6 sections, 7 columns, kebab |
| `/admin/[id]` | Order detail — A3, sticky bar, timeline, audit |
| `/api/track` | H1 phone enforcement, rate limited |
| `/api/admin/orders` | sections, search, filters, paging, live stage |
| `/api/admin/orders/[id]` | GET events · soft DELETE (admin) |
| `.../[id]/stage` | manual move, writes the clock anchor |
| `.../[id]/milestone` | label / picked / delivered override |
| `.../[id]/damaged` | mark damaged + create replacement |
| `.../[id]/restore` | undo soft delete (admin) |
| `.../from-order-central` | DOC bridge — accepts backdated order_date |
| `.../add-days`, `.../delay` | DOC bridge |
| `/api/admin/users`, `/[id]` | user management (admin) |
| `/api/admin/me`, `/login`, `/logout` | session |
| `/api/admin/audit` | audit log (admin) |
| `/api/status/[tracking_id]` | DOC status read |
| `/api/status/order/[dropy_order_id]` | **poll this one** — surfaces replacements |
| `/api/webhooks/courier-updates-a` | Shiprocket — parses and advances |
| `/api/webhooks/courier-updates-b` | Velocity — **captures only, see below** |

### Bundle

| | Next.js | This |
|---|---|---|
| JS | 176 kB first load | **45 kB gzipped** |
| CSS | included above | 7.3 kB gzipped |
| `node_modules` | 504 MB | 85 MB |
| Dependencies | 68 | 12 |

### Velocity webhook is capture-only, deliberately

Their API is documented and their webhook config exists, but no real payload
has been captured from this store. A parser written against a guessed shape
would look finished and silently do nothing.

To unblock: point Velocity at `/api/webhooks/courier-updates-b`, fire a test
event, then

    select payload, headers from captured_velocity_webhooks
    order by received_at desc limit 1;

One row answers which header carries the key, the real field names, and
whether the shape differs per event type. Until then the manual milestone
override in the admin panel covers Velocity orders.

### Not ported

`/api/seed` — demo seeding. It deletes and rebuilds event trails on real order
rows, which was always its risk, and with real data arriving it has no
remaining purpose.

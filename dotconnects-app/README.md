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

## Complete

5 pages, 21 API routes, 329 tests, 0 typecheck errors, 0 svelte-check warnings.

| Page | |
|---|---|
| `/` | Customer tracking — one-screen search, card sections |
| `/admin` | Orders table — 6 sections, 7 columns, kebab |
| `/admin/[id]` | Order detail — timeline, milestones, sticky bar, audit |
| `/admin/new` | Manual order creation |
| `/admin/users` | User management (admin only) |

### Bundle

| | Next.js | This |
|---|---|---|
| JS | 176 kB first load | **49 kB gzipped** |
| CSS | included above | 11.4 kB gzipped |
| Fonts | Google-hosted | self-hosted woff2, fetched on demand |
| `node_modules` | 504 MB | ~90 MB |

### Fonts are self-hosted

Sora, Inter, JetBrains Mono and Instrument Serif ship as `@fontsource`
packages, so there is no request to Google on first paint and no
third-party dependency in the render path.

**This was a real bug when the app was first ported.** `tokens.css`
references `var(--font-sora)`, which the Next app defined via
`next/font/google` in `layout.tsx`. Copying the tokens without porting the
loader left every one of those references undefined, so everything fell
through to system fonts. Nothing errored — an undefined CSS variable is
not an error, it just resolves to the next item in the stack. See
`src/lib/styles/fonts.css`.

### Not included, deliberately

| | Why |
|---|---|
| Shopify write-back | Needs the fulfillment decision resolved first |
| Shiprocket / Velocity API push | Needs credentials and a store setup |
| Velocity webhook parser | Needs one real captured payload |
| `/api/seed` | Deleted event trails on real rows; no purpose now |

# DotConnects Logistics

Two apps, one repo, one Supabase database.

    carrier/            Next.js  → dotconnects.in        marketing, quote, legal
    dotconnects-app/    SvelteKit → track.dotconnects.in  tracking, admin, API

One domain. `track.` is a DNS record on it, not a second purchase.

## Why two apps

The marketing site is content — mostly static, SEO lives there, and it was
already built and working. The tracking page and admin panel are an
application, and they're what a customer opens on a phone in India.

Splitting them means the page that matters ships **45 kB** instead of 176 kB,
without rebuilding an About page nobody complained about.

## Working on them

    cd carrier            && npm install && npm run dev     # :3000
    cd dotconnects-app    && npm install && npm run dev     # :5173

Separate `node_modules`, separate `.env`. They share only the Supabase
database — and a copy of the design tokens.

## Before pushing

    cd carrier          && npx tsc --noEmit && npx vitest run && npx next build
    cd dotconnects-app  && npx tsc --noEmit && npx vitest run && npm run build

`next build` and `vite build` are the checks that matter most: they enumerate
every route. A misnamed route file simply doesn't appear, and neither tsc nor
vitest can see that.

## Vercel

**Two projects, one repo.** Each needs its Root Directory set:

| Project | Root Directory | Domain |
|---|---|---|
| carrier | `carrier` | dotconnects.in |
| dotconnects-app | `dotconnects-app` | track.dotconnects.in |

Project Settings → General → Root Directory. Without it, Vercel builds from
the repo root, finds no framework, and fails.

Both deploy on a push to `main`. Vercel only rebuilds a project when files
under its root actually changed.

## The design tokens are duplicated

`carrier/app/globals.css` and `dotconnects-app/src/lib/styles/tokens.css` hold
the same colour and type tokens.

Deliberately a copy, not a shared package — one maintainer, and a shared
package means a build step for ~400 lines of CSS variables.

**The trade-off, stated plainly: change a colour in one and you must change it
in the other. They will drift. When they do, `tokens.css` is the one customers
see.**

## Docs

`docs/` holds the phase documents — requirements, architecture, plan of
action, wireframes, and the two behaviour inventories written before the
component rebuilds.

# Carrier

Marketing site + live shipment tracker for beauty, personal-care and wellness
stock imported from the USA into India.

Next.js 15 (App Router) · React 19 · Tailwind CSS v4 · TypeScript ·
Motion (Framer Motion) · GSAP ScrollTrigger · Supabase.

## Run it

```bash
npm install
npm run dev     # http://localhost:3000
npm run build
npm start
```

> **Stop `npm run dev` before running `npm run build`.** Both write to `.next`,
> and running them together leaves the dev server serving a half-production
> tree — the page then loads with chunks missing and 500s in the console. If
> that happens: stop node, `rm -rf .next`, and start dev again.

It runs with no configuration — with no Supabase project connected, every
query falls back to [lib/demo-data.ts](lib/demo-data.ts).

## Pages

| Route         | What it is                                                                                                             |
| ------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `/`           | Landing — hero, console mockup, categories, how-it-works, customs desk, features, stats, lane table, limits, clients, founders, FAQ, CTA |
| `/track`      | Public tracker — single-consignment lookup, full timeline and compliance panel                                          |
| `/api/track`  | `GET ?q=` — exact-identifier lookup only (Supabase, falling back to demo data)                                           |
| `/api/seed`   | `POST` — pushes demo data into Supabase (guarded by `SEED_SECRET`)                                                       |

The hero box routes to `/track?id=<query>` and runs the search on arrival, so
tracking links can be emailed to clients.

## Confidentiality

The public tracker resolves **one consignment from an identifier you already
hold**. It deliberately does not:

- list consignments (the old "Active consignments" grid exposed every client's
  company name, SKU counts, declared values and clearance status to anyone);
- resolve a company or contact name (a bare consignee name would otherwise
  return that client's entire shipment history);
- match on partial strings, so the endpoint can't be used to enumerate the
  table by walking `CRR-`.

`searchShipments(query, { allowNameSearch })` gates name lookup, and
[app/api/track/route.ts](app/api/track/route.ts) passes `false`. Turn it on
only inside a session already scoped to a single consignee — and scope the RLS
policy to match (see below), because the flag protects the query, not the row.

## Search

One field, exact identifiers only:

| Input             | Example          | Public |
| ----------------- | ---------------- | ------ |
| Tracking number   | `CRR-4821-US`    | yes    |
| PO reference      | `PO-2026-1164`   | yes    |
| Container / AWB   | `MRKU 704 2213`  | yes    |
| Company name      | `Northgate`      | no — signed-in only |
| Contact name      | `A. Placeholder` | no — signed-in only |

Spaces and hyphens are normalised, so `MRKU7042213` and `MRKU 704 2213` both
resolve.

Demo tracking numbers cover every state worth styling: `CRR-4821-US` (in
transit), `CRR-4795-US` (at customs), `CRR-4610-US` (**customs hold** —
exception treatment), `CRR-4903-US` (MRP labelling), `CRR-4488-US`
(delivered), `CRR-4930-US` (booked, FSSAI).

## Supabase

1. Create a project, then run [supabase/schema.sql](supabase/schema.sql) in the
   SQL editor. It creates `shipments` and `shipment_events`, indexes, an
   `updated_at` trigger, and RLS policies.
2. Copy `.env.local.example` to `.env.local` and fill in the URL, anon key,
   service-role key, and a `SEED_SECRET`.
3. Seed it from the same source of truth the fallback uses:

   ```bash
   curl -X POST http://localhost:3000/api/seed -H "x-seed-secret: YOUR_SECRET"
   ```

   The route is idempotent — re-running it replaces each shipment's event trail
   rather than duplicating it.

Once the env vars are present, [lib/shipment-service.ts](lib/shipment-service.ts)
queries Supabase instead. If a query errors or returns nothing, it falls back to
demo data rather than showing an empty page. Sample tracking numbers are only
offered on the page while running on demo data.

**Two things to change before real client data goes in:**

- The RLS policies still grant `select` to `anon` on every row. The app no
  longer *exposes* that — lookup is exact-identifier only — but the policy is
  the real boundary, and anyone with the anon key can query Supabase directly.
  Scope the SELECT policy to an authenticated consignee before real data goes
  in; there is a commented example in `schema.sql`.
- Timestamps are stored as pre-formatted display strings so server and client
  render identically. If you move to real `timestamptz` columns, format them in
  exactly one place to avoid hydration mismatches.

Adding a scan in production is one insert into `shipment_events` — use the
service-role key from a server process or an Edge Function, never the browser.

## Design language

A deliberate blend rather than one system:

- **Linear** — near-black `#010102` canvas, the surface ladder, hairline
  borders, scarce lavender accent, tight negative display tracking.
- **Vercel / Stripe** — real depth on dark: an elevation scale (`--shadow-xs`
  → `--shadow-xl` plus two lavender glows), 1px gradient borders via mask
  compositing, glass panels, bento composition.
- **Editorial** — Instrument Serif italic mixed into the display sans for one
  emphasised phrase per headline, so headings read as designed.

Type: **Sora** (display), **Inter** (body), **Instrument Serif** (accent),
**JetBrains Mono** (IDs and figures). Icons are **lucide-react**.

Radii were raised across the board — buttons 10px, cards 16px, panels 20px,
hero surfaces 28–36px.

Reusable surface treatments live in `@layer components` in
[app/globals.css](app/globals.css): `.gradient-border`, `.glass`, `.shine`,
`.spotlight`, `.grid-bg`, `.dot-bg`, `.noise`, `.edge-lift`, `.text-fade`,
`.serif-accent`.

## Motion

Everything respects `prefers-reduced-motion`; with it on, scroll scrubs and
transforms are skipped and only opacity remains.

- **[components/motion/primitives.tsx](components/motion/primitives.tsx)**
  (Motion) — `Reveal`, `Stagger`/`StaggerItem`, `AnimatedNumber` (count-up on
  view), `Magnetic` (cursor pull on CTAs), `Tilt`, `HoverLift`.
- **[components/motion/gsap-scenes.tsx](components/motion/gsap-scenes.tsx)**
  (GSAP + ScrollTrigger) — `PerspectivePanel` tilts the product panels up as
  they enter, `SplitHeadline` rises the hero word by word, `DrawLine` scrubs a
  rule. `gsap.matchMedia` gates the scrub to wide, motion-tolerant viewports and
  reverts cleanly on unmount.

- **[components/fx/](components/fx/)** — `Backdrop` (drifting aurora + blueprint
  grid + grain), `ScrollProgress` (top gradient bar), `SpotlightTracker` (one
  document-level listener feeding `--mx`/`--my` to every `.spotlight` card).

Micro-interactions: cursor-tracked spotlight on cards, hover lift with shadow
escalation, diagonal shine sweep on buttons, magnetic CTAs, sliding nav hover
pill and animated filter pill (`layoutId`), route bars that fill on view,
pulsing live-status rings, glow-on-focus search fields, search spinner and
skeleton, arrow nudges, slow image zoom on hover, floating hero tiles.

## Light and dark

Both ship. **Light is the default**; a saved choice or a system dark preference
switches it. The toggle sits in the nav.

Every utility resolves through the same custom properties, so the light theme
is one override block in [app/globals.css](app/globals.css) —
`:root[data-theme="light"]` redefines the tokens and the whole site flips. No
duplicated component styles, no `dark:` prefixes scattered through the markup.

An inline script in [app/layout.tsx](app/layout.tsx) resolves the theme from
`localStorage`, falling back to `prefers-color-scheme`, and stamps `data-theme`
on `<html>` **before first paint** — otherwise the page renders dark and snaps
to light on hydration. That is also why `<html>` carries
`suppressHydrationWarning`.

The light canvas is a warm off-white (`#fbfaf7`), not `#fff` — paper rather
than a lightbox. Light also gets its own shadow ramp (dark's deep blacks look
like soot on white), a muted aurora, darker accent hues for contrast, and
inverted grid/noise overlays.

Two theme-aware details worth knowing before you edit layout:

- **`.band-raised`** (the alternating section band) steps *up* to `surface-2`
  in light, but in dark it sits *between* canvas and `surface-1`. Stepping up
  in dark would make the band lighter than the cards inside it and invert the
  elevation.
- **`.photo-band`** is for a photo sitting behind text. Dark can carry it at
  60% opacity; light drops to 22%, because the same image destroys contrast for
  the dark type on top. Photos that are *not* behind text use `.photo` at full
  opacity in both themes.

## Colour coding

Colour carries meaning here, it is not decoration. Two coding systems, both
defined once as tokens in `@theme`:

**Shipment state** — [lib/status.ts](lib/status.ts) is the single source of
truth, so the console mockup, the tracker cards and the detail panel can never
disagree. Each state supplies a dot, pill, edge bar and text colour.

| State | Colour |
| --- | --- |
| Booked | neutral grey |
| In transit | lavender `#5e6ad2` |
| Customs clearance | amber `#e0a04a` |
| **Customs hold / exception** | **alert orange-red `#e2704e`** |
| MRP labelling · Out for delivery | cyan `#4bb6d8` |
| Delivered | green `#3fb95c` |

Mode is coded too — air cyan, ocean lavender, express green.

**Product category** — each of the four categories owns a hue used on its top
bar, HS-code badge and icon tile: cosmetics rose `#e0699a`, skincare cyan
`#4bb6d8`, fragrance amber `#d9a441`, supplements green `#45b06d`. The
four-step process reuses the same ramp so a reader learns one palette.

Tailwind cannot see interpolated class names, so every colour class is written
out in full in the data arrays — never `text-${x}`.

## Tokens

Everything lives in `@theme` in [app/globals.css](app/globals.css) — colours,
type scale, radii, shadows, spacing. Change a token there and it propagates.

- **Canvas** `#010102`, never `#000000`. Five-step surface ladder.
- **Lavender** `#5e6ad2` stays the primary accent — brand mark, primary CTA,
  focus, route progress, live dots. A warm sand `#d8b4a0` carries the serif
  accent only. Green `#27a644` is the only semantic colour.
- Primitives are in [components/ui.tsx](components/ui.tsx): `Button`,
  `ButtonLink`, `Card`, `ProductPanel`, `IconTile`, `StatusBadge`, `Section`,
  `SectionHeading`, `Container`, `Eyebrow`.

## Images

Fourteen photographs, served from `images.unsplash.com` (allow-listed in
`next.config.ts`) through `next/image`. Every ID in
[lib/images.ts](lib/images.ts) was downloaded and **visually inspected** before
use — candidates showing a third-party brand's packaging were rejected so the
site never implies a relationship that does not exist. Each has a real `alt`.
Photos run at **full opacity** with a `.photo` filter that lifts saturation and
midtones, because on a near-black canvas anything dimmed below ~70% reads as
mud. Only the edge that meets the card is feathered with a gradient — never the
whole image — so the subject stays legible.

Freepik and Pinterest were not used: Freepik's free tier requires attribution
and forbids redistribution in a template, and Pinterest hosts other people's
copyrighted work with no licence to reuse. Unsplash permits hotlinking and
commercial use without attribution.

To drop the third-party dependency, download the files into `/public` and
change the `src` values — nothing else changes.

## Content status

- **Real:** client names, sites, cities and what each distributes (all public
  information from their own websites); the founders; the compliance regimes
  (CDSCO cosmetic import registration, FSSAI for nutraceuticals, Legal
  Metrology MRP labelling, residual shelf-life rules).
- **Invented:** everything in [lib/demo-data.ts](lib/demo-data.ts) — consignees,
  contacts, brands, tracking numbers, timestamps, values, registration numbers.
  Also the stats band, the phone number and the `carrier.example` addresses.

Two rules this repo learned the hard way, both worth keeping:

**Demo data must not name real companies.** The consignments originally carried
the six real client names, with declared values, contact names and a customs
hold. In a public repo that reads as a disclosure of those clients' cargo
values and compliance status, and git history survives deletion. The consignees
are now fictional; if you need realistic data, invent new companies rather than
reusing actual ones.

**Regulatory claims are gated.** [lib/company.ts](lib/company.ts) holds every
factual assertion behind a `verified` flag, and only `verified: true` items
render. An IATA agent number, an AEO tier or a customs broker licence is a
regulated assertion, not marketing copy — a plausible-looking invented one is
worse than none.

There are deliberately **no testimonials**. Attributing invented quotes to real
named clients would be fabricating a record — add real ones with their sign-off
instead.

## Client marks

Client cards render an initials monogram tinted with the company's own brand
colour (`mark` and `brandColor` in [lib/clients.ts](lib/clients.ts)) — used on
the chip, the card's left edge and the hover wash.

Real logo files were removed. They are the clients' trademarks, and shipping
them in a public repo implies an endorsement none of them gave. To use real
logos: get written sign-off, put the files in `public/clients/`, add a `logo`
field to the `Client` type, and swap `Mark` for an `Image` in
[components/Clients.tsx](components/Clients.tsx).

Note for that path: Next's image optimizer rejects SVG unless
`dangerouslyAllowSVG` is set, which would admit *any* SVG including remote ones
that can carry script. Mark individual SVG logos `unoptimized` instead.

## Founder photos

[lib/clients.ts](lib/clients.ts) has a `photo` field per founder, currently
`null`. Drop a portrait at `public/team/jaydev.jpg`, set the path, and the card
swaps the monogram for the photo — no other change needed.

It is left null on purpose: a stock photo of a stranger standing in for a real
named founder would be a misrepresentation, so the card shows a designed
monogram and "Photo to come" until a real image exists.

## A gotcha worth keeping

Scroll reveals share one `VIEWPORT` config from
[components/motion/primitives.tsx](components/motion/primitives.tsx), with a
400px root margin in both directions.

That is not a style choice. With `once: true`, if an element passes completely
between two IntersectionObserver callbacks — fast scroll, anchor jump, restored
scroll position — the observer only ever reports "not intersecting", the
animation never fires, and the content sits at `opacity: 0` **permanently**.
The wide margin makes the trigger band viewport + 800px, so no jump shorter
than 800px can skip it.

For the same reason, don't nest a `whileInView` inside a parent that already
animates in. The scan-feed rows and stage rail in `BentoFeatures` are static
for exactly this reason.

## Accessibility

Audited with a scripted pass (contrast, tap targets, heading order, landmarks,
accessible names, duplicate ids, link safety) across light/dark × desktop/mobile
× home/tracker. Current state: **0 contrast failures, 0 heading issues, 0
missing accessible names, 0 landmark issues.**

Three token-level fixes came out of it — worth knowing before you re-tune colour:

| Token | Was | Now | Why |
| --- | --- | --- | --- |
| `--color-ink-tertiary` (light) | `#938d80` | `#6b665b` | 3.16:1 — and it carries nearly every caption on the site |
| `--color-ink-tertiary` (dark) | `#62666d` | `#7c8088` | 3.62:1 |
| `--color-semantic-warn` (light) | `#a4701a` | `#8a5c0f` | 4.28:1 — amber is the hardest hue to keep legible on white |
| `--color-accent` (light) | `#a9714a` | `#8c5730` | passed as *large* text at desktop, but its clamp drops to 20px on mobile where 4.5:1 applies |

That last one is the trap worth remembering: a `clamp()` heading can satisfy the
large-text threshold on desktop and fail it on a phone.

Also added: a skip-to-content link, `py-1` on footer links (they measured 22px,
under the WCAG 2.2 AA 24px minimum), and the product-mockup heading demoted to a
`<p>` — an `h3` inside decorative chrome was skipping the document from h1 to h3.

## Claims and placeholders

Everything the site asserts about the business lives in
[lib/company.ts](lib/company.ts), each entry flagged `verified: true | false`.
Nothing marked false renders.

The footer previously carried **"AEO-T2 accredited · Customs broker licence
R-11/2019"** and the hero claimed **"IATA cargo agent"**. Those numbers and
accreditations were invented. They are regulated assertions rather than
marketing copy, so they now sit in `company.credentials` with `verified: false`
and the footer renders nothing until you flip them.

Still placeholder and needing your real values:

- `COMPANY.email`, `COMPANY.phone` (`carrier.example` is a reserved domain)
- `COMPANY.stats` — the 11,400 consignments / 98.2% on-time / 1.4 days / 42
  states figures are all invented
- Every tracking number, timestamp, duty figure and CDSCO/FSSAI number in
  `lib/demo-data.ts`

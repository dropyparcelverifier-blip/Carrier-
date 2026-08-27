# Apply

Extract INTO `DotConnects Logistics` (the folder with `.git`). Overwrite.

## 1 · Migration first

`carrier/supabase/migration-v4.sql` into the Supabase SQL editor. Creates
`business_queries`. Run twice to confirm it's idempotent.

## 2 · One env var

`carrier/.env.local`, no quotes:

    SUPABASE_SERVICE_ROLE_KEY=<same key the tracking app uses>

`SUPABASE_URL` is already there.

## 3 · Verify

    cd carrier
    npm install
    npx tsc --noEmit ; npx vitest run ; npx next build      # 49 tests

    cd ..\dotconnects-app
    npx svelte-kit sync
    npx tsc --noEmit ; npx vitest run ; npx vite build      # 336 tests

    cd ..
    git add -A
    git commit -m "Homepage layout, flight path, enquiry pipeline, 14-lane network"
    git push origin main

---

# The homepage layout

Sections used to stack full width at a uniform rhythm, separated by
hairlines. Readable, but nothing had a shape and there was nowhere for a
flight path to go except straight down behind the text.

    ┌───────────────────────────────────┐
    │  HERO                        ✈    │   full
    └───────────────────────────────────┘
                  ↓
       ┌──────────────────┐
       │  SERVICES        │      ✈        left
       └──────────────────┘
                  ↓
                     ┌──────────────────┐
            ✈        │  HOW IT MOVES    │  right
                     └──────────────────┘
                  ↓
    ┌───────────────────────────────────┐
    │  COVERAGE — map      ✈            │   full · the payoff
    └───────────────────────────────────┘
                  ↓
       ┌──────────────────┐
       │  OUTCOMES        │         ✈     left
       └──────────────────┘
                  ↓
                     ┌──────────────────┐
            ✈        │  FAQ             │  right
                     └──────────────────┘

`PageSection` handles it. Offset sections take 58% on a wide screen,
leaving ~40% clear for the aircraft to cross — **the whitespace has a
job** rather than being padding. Vertical rhythm went from `pt-8` to
`py-20 md:py-28`.

Below `lg` everything is full width. On a phone an offset column is just
a narrower column.

Alignment is explicit per section, not derived from an index: the map and
the stats band need full width to work, and automatic alternation would
fight them.

# The flight path — rebuilt

**The first version was wrong.** It drew one continuous arc down the page
background and slid a marker along it — a decorative line behind the
content, unrelated to anything on screen.

This one does what was asked: the aircraft **holds a fixed position on
screen** while the page scrolls past, and moves horizontally between
waypoints as each section takes over the viewport. It visits the cards.

- Eased between waypoints (`easeInOutCubic`), so it flies the gap rather
  than jumping at section boundaries
- Banks into the turn, clamped to ±28° so it never points straight down
- Dotted trail shows only the route already flown
- Desktop only, off entirely under `prefers-reduced-motion`
- No dependency — one fixed element, one polyline, scroll throttled to
  animation frames

# Data sharing — reworded twice

**First version:** *"We may share your enquiry with our carrier partner so
they can quote you directly."*

That made DotConnects sound like a broker passing work along. Wrong
positioning, and you're the carrier here.

**Now, on the form:**

> Your enquiry is shared internally with the teams who quote and route the
> lane you're asking about. We don't sell your details or add you to a
> mailing list.

**And in the privacy policy**, with the detail:

> Business enquiries submitted through our contact form are shared
> internally with the teams who handle quoting, routing and operations for
> the lane you asked about. That may include colleagues at the partner
> organisations we operate warehouses and freight capacity with, where they
> need the detail to price or route your consignment.

Same fact, correct framing. The policy carries the specifics so the form
stays short — which is the right split.

# Rate limiting — kept

3 per email, 10 per IP, per hour. Counted from the database rather than
memory: Vercel runs each request on a fresh serverless invocation with no
shared state, so an in-memory counter resets constantly and limits
nothing.

**There is no CAPTCHA.** I mentioned one only to explain the honeypot, and
that was a pointless thing to raise about something you never asked for.

---

# Still open

- Tracking stage redesign — 2-line entries, coded hub names, ocean stages
- Shiprocket / Velocity APIs — on hold at your call
- GMC transit time — on hold at your call
- `/about`, `/quote`, `/contact` layouts — homepage first, as you said

-- ============================================================
-- Dropy Order Tracking — Supabase schema
-- Run in the Supabase SQL editor. Safe to re-run (idempotent):
-- `create table if not exists` and the explicit `drop policy if exists`
-- statements below mean running this again just re-applies the current
-- state rather than erroring or duplicating anything.
--
-- After running this, the app needs a SUPABASE_SERVICE_ROLE_KEY env var
-- (Project Settings → API → service_role key in the Supabase dashboard —
-- NOT the anon key) for the admin panel and tracking lookups to work, since
-- the anon key now has zero table access. See lib/supabase-admin.ts.
-- ============================================================

-- 1. Admin users (simple auth)
create table if not exists public.admin_users (
  id           uuid primary key default gen_random_uuid(),
  username     text not null unique,
  password_hash text not null,
  full_name    text not null,
  created_at   timestamptz not null default now()
);
-- password_hash is "<salt-hex>:<hash-hex>" (scrypt, see lib/password.ts), not
-- plaintext. The value below is the hash for the default seed password
-- "dropy@admin2026" — change it (call hashPassword() and update this row)
-- before this goes in front of a customer.
insert into public.admin_users (username, password_hash, full_name)
values (
  'admin',
  '57c1979535afc5d04895fe81aa23b934:83998cb05d129da19d6a2d4c467b59d71cd828b75afc386c0dfc5a5541c68e132c4e01352289cf80b66dee1ae45e098295cafceca22054766a570af44703be9f',
  'Dropy Admin'
)
on conflict (username) do nothing;

-- 2. Orders
create table if not exists public.dropy_orders (
  id                uuid primary key default gen_random_uuid(),
  dropy_order_id    text not null unique,
  tracking_id       text not null unique,
  us_order_id       text,
  origin_country    text not null default 'United States',
  -- Default matches lib/order-routes.ts's real order-routes (Newark/JFK
  -- direct to Mumbai), not lib/routes.ts's display-only route set — every
  -- real order picks one of the two via pickOrderRoute() explicitly, so
  -- this only matters as a fallback for a row inserted without going
  -- through that path.
  route_key         text not null default 'newark-mumbai-direct',
  -- Per-order jitter seed (0-9999) — see lib/order-routes.ts jitterTimingPct.
  -- Generated once at creation via randomTimingSeed() and never changes, so
  -- the same order's stage-timing always jitters the same way.
  timing_seed       integer not null default 0,
  customer_name     text not null,
  customer_mobile   text not null,
  customer_email    text,
  customer_address  text,
  customer_city     text not null default 'Mumbai',
  customer_pincode  text,

  items             jsonb not null default '[]',
  total_weight_kg   numeric not null default 0,
  total_items       integer not null default 0,
  declared_value_usd numeric not null default 0,

  -- Air freight runs 1-30 working days; ocean freight's real transit window
  -- (34-46 days, per components/TransportModes.tsx) needs headroom past
  -- that, so this caps at 90 rather than assuming every order is air. Named
  -- explicitly so the 3b migration block below can widen it on an existing
  -- table without guessing Postgres's auto-generated constraint name.
  shipping_days     integer not null default 10
                      constraint dropy_orders_shipping_days_check check (shipping_days between 1 and 90),
  shipping_mode     text not null default 'Air Freight'
                      check (shipping_mode in ('Air Freight','Express Air','Ocean Freight')),

  current_stage     text not null default 'order_placed'
                      check (current_stage in (
                        'order_placed','processing','packed','dispatched',
                        'at_us_airport','us_customs_cleared','in_transit_departed',
                        'mid_transit','arrived_india','indian_customs',
                        'customs_cleared','at_vashi_warehouse','qc_check',
                        'handed_to_courier','exception'
                      )),
  status            text not null default 'Order Placed'
                      check (status in (
                        'Order Placed','Processing','In Transit',
                        'Customs Clearance','At Warehouse','Received',
                        'Forwarded to Courier'
                      )),
  progress          integer not null default 0 check (progress between 0 and 100),

  payment_status    text not null default 'Unpaid'
                      check (payment_status in (
                        'Unpaid','Partially Paid','Fully Paid',
                        'Cash on Delivery','Refunded'
                      )),

  order_date        timestamptz not null default now(),
  estimated_delivery text not null default '',
  actual_delivery   timestamptz,

  admin_notes       text,
  -- Overridden with the real route's carrier (Air India Cargo — see
  -- lib/order-routes.ts) by every real code path that creates an order
  -- (create-order.ts); this default only matters for a row inserted
  -- through some other path entirely.
  carrier_name      text default 'DotConnects Logistics',
  awb_number        text,

  -- Last-mile handover (Vashi -> customer doorstep) — a distinct leg from
  -- the international awb_number above. "Shiprocket"/"Velocity" are the
  -- fulfilment PLATFORMS DotConnects Logistics books through, not physical
  -- couriers themselves (see lib/last-mile.ts) — last_mile_awb is that
  -- platform's own tracking reference.
  last_mile_courier    text check (last_mile_courier in ('Shiprocket','Velocity')),
  last_mile_awb        text,
  -- The REAL tracking URL, synced from Order Central's own records (see
  -- scripts/sync-last-mile.js) rather than reconstructed from a template —
  -- courierTrackingUrl() in lib/last-mile.ts only falls back to building
  -- one from courier+awb when this is null, e.g. for an order an admin set
  -- up manually before a sync ran. Kept separate from last_mile_awb so a
  -- sync can update the URL without needing to also touch the AWB.
  last_mile_tracking_url text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- 3. Order tracking events
create table if not exists public.dropy_order_events (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.dropy_orders(id) on delete cascade,
  stage        text not null check (stage in (
                 'order_placed','processing','packed','dispatched',
                 'at_us_airport','us_customs_cleared','in_transit_departed',
                 'mid_transit','arrived_india','indian_customs',
                 'customs_cleared','at_vashi_warehouse','qc_check',
                 'handed_to_courier','exception'
               )),
  label        text not null,
  location     text not null,
  -- Only set on the first-mile vendor-pickup leg, where the mover genuinely
  -- differs from the shipment's main carrier (dropy_orders.carrier_name,
  -- always Air India Cargo for a real order) — null everywhere else. See
  -- lib/order-routes.ts orderRouteStageCarrier.
  carrier      text,
  happened_at  text not null,
  note         text,
  state        text not null check (state in ('done','current','pending','exception')),
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);

-- 3b. Migration: us_order_id / payment_status were added to the app
-- (AdminClient.tsx, app/api/admin/orders/route.ts) after this table was first
-- created in Supabase, so `create table if not exists` above never applied
-- them to the live table. This block backfills them on an already-existing
-- table; harmless no-op on a fresh one since the columns are already there.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'dropy_orders' and column_name = 'us_order_id'
  ) then
    alter table public.dropy_orders add column us_order_id text;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'dropy_orders' and column_name = 'payment_status'
  ) then
    alter table public.dropy_orders add column payment_status text not null default 'Unpaid'
      check (payment_status in ('Unpaid','Partially Paid','Fully Paid','Cash on Delivery','Refunded'));
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'dropy_orders' and column_name = 'route_key'
  ) then
    alter table public.dropy_orders add column route_key text not null default 'newark-mumbai-direct';
  end if;
  -- Renamed from 'newark-frankfurt-delhi' when that route was corrected to
  -- land directly in Mumbai instead of detouring through Delhi (lib/routes.ts)
  -- — existing rows/defaults still pointing at the old key would silently
  -- fall through to getRoute()'s ROUTES[0] fallback otherwise.
  update public.dropy_orders set route_key = 'newark-frankfurt-mumbai' where route_key = 'newark-frankfurt-delhi';
  -- Real orders switched from lib/routes.ts's display route set to
  -- lib/order-routes.ts's two real direct routes (Newark/JFK -> Mumbai,
  -- Air India, no transit hub) — the default now matches that, so a row
  -- inserted without an explicit route_key gets a real one.
  update public.dropy_orders set route_key = 'newark-mumbai-direct' where route_key = 'newark-frankfurt-mumbai';
  alter table public.dropy_orders alter column route_key set default 'newark-mumbai-direct';
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'dropy_orders' and column_name = 'origin_country'
  ) then
    alter table public.dropy_orders add column origin_country text not null default 'United States';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'dropy_orders' and column_name = 'timing_seed'
  ) then
    alter table public.dropy_orders add column timing_seed integer not null default 0;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'dropy_order_events' and column_name = 'carrier'
  ) then
    alter table public.dropy_order_events add column carrier text;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'dropy_orders' and column_name = 'last_mile_courier'
  ) then
    alter table public.dropy_orders add column last_mile_courier text check (last_mile_courier in ('Shiprocket','Velocity'));
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'dropy_orders' and column_name = 'last_mile_awb'
  ) then
    alter table public.dropy_orders add column last_mile_awb text;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'dropy_orders' and column_name = 'last_mile_tracking_url'
  ) then
    alter table public.dropy_orders add column last_mile_tracking_url text;
  end if;
end $$;

-- 3c. Migration: widen the current_stage/status check constraints on an
-- already-existing table to allow the new handed_to_courier stage /
-- "Forwarded to Courier" status (originally named "Out for Delivery",
-- renamed — see the update statement below) — added when last-mile
-- handover tracking (Shiprocket/Velocity) was introduced. Same
-- drop-and-recreate pattern as 3c's shipping_days widening: finds the
-- live constraint by inspecting what it actually checks (not by guessing
-- Postgres's auto-generated name), and only touches it if the new values
-- aren't already allowed.
do $$
declare
  stage_constraint  text;
  status_constraint text;
begin
  select conname into stage_constraint
  from pg_constraint
  where conrelid = 'public.dropy_orders'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%current_stage%';

  if stage_constraint is not null and pg_get_constraintdef(
    (select oid from pg_constraint where conname = stage_constraint and conrelid = 'public.dropy_orders'::regclass)
  ) not ilike '%handed_to_courier%' then
    execute format('alter table public.dropy_orders drop constraint %I', stage_constraint);
    alter table public.dropy_orders add constraint dropy_orders_current_stage_check
      check (current_stage in (
        'order_placed','processing','packed','dispatched',
        'at_us_airport','us_customs_cleared','in_transit_departed',
        'mid_transit','arrived_india','indian_customs',
        'customs_cleared','at_vashi_warehouse','qc_check',
        'handed_to_courier','exception'
      ));
  end if;

  -- The constraint MUST allow 'Forwarded to Courier' BEFORE the UPDATE
  -- below writes that value into any row — the still-OLD constraint (only
  -- allowing 'Out for Delivery') rejects the literal string
  -- 'Forwarded to Courier' outright otherwise, which is the real error
  -- this migration hit: dropping/recreating the constraint AFTER the
  -- UPDATE meant the UPDATE ran against the old constraint and failed
  -- before ever reaching the new one.
  select conname into status_constraint
  from pg_constraint
  where conrelid = 'public.dropy_orders'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%status%' and pg_get_constraintdef(oid) ilike '%Order Placed%';

  if status_constraint is not null and pg_get_constraintdef(
    (select oid from pg_constraint where conname = status_constraint and conrelid = 'public.dropy_orders'::regclass)
  ) not ilike '%Forwarded to Courier%' then
    -- Widen the constraint to allow BOTH the old and new values at first —
    -- letting existing 'Out for Delivery' rows keep satisfying it — so the
    -- UPDATE just below (which migrates them to the new value) can run
    -- without the chicken-and-egg problem above. The narrower final
    -- constraint (new value only) goes on right after, once no row can
    -- possibly still hold the old one.
    execute format('alter table public.dropy_orders drop constraint %I', status_constraint);
    alter table public.dropy_orders add constraint dropy_orders_status_check
      check (status in (
        'Order Placed','Processing','In Transit',
        'Customs Clearance','At Warehouse','Received',
        'Forwarded to Courier','Out for Delivery'
      ));
  end if;

  -- Existing "Out for Delivery" rows (the previous name for this same
  -- status — renamed because it overstated proximity to the customer's
  -- door right at the moment of handover, not doorstep arrival) migrated
  -- forward. Safe now — the constraint above already allows the new value.
  update public.dropy_orders set status = 'Forwarded to Courier' where status = 'Out for Delivery';

  -- Now that no row can hold the retired value, drop it from the allowed
  -- list — same drop-and-recreate, only touches the constraint again if
  -- the wider (both-values) version above is still what's live.
  select conname into status_constraint
  from pg_constraint
  where conrelid = 'public.dropy_orders'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%status%' and pg_get_constraintdef(oid) ilike '%Order Placed%';

  if status_constraint is not null and pg_get_constraintdef(
    (select oid from pg_constraint where conname = status_constraint and conrelid = 'public.dropy_orders'::regclass)
  ) ilike '%Out for Delivery%' then
    execute format('alter table public.dropy_orders drop constraint %I', status_constraint);
    alter table public.dropy_orders add constraint dropy_orders_status_check
      check (status in (
        'Order Placed','Processing','In Transit',
        'Customs Clearance','At Warehouse','Received',
        'Forwarded to Courier'
      ));
  end if;

  -- Same widening on dropy_order_events.stage, which carries the same
  -- 14-value check as dropy_orders.current_stage.
  declare
    event_stage_constraint text;
  begin
    select conname into event_stage_constraint
    from pg_constraint
    where conrelid = 'public.dropy_order_events'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%order_placed%';

    if event_stage_constraint is not null and pg_get_constraintdef(
      (select oid from pg_constraint where conname = event_stage_constraint and conrelid = 'public.dropy_order_events'::regclass)
    ) not ilike '%handed_to_courier%' then
      execute format('alter table public.dropy_order_events drop constraint %I', event_stage_constraint);
      alter table public.dropy_order_events add constraint dropy_order_events_stage_check
        check (stage in (
          'order_placed','processing','packed','dispatched',
          'at_us_airport','us_customs_cleared','in_transit_departed',
          'mid_transit','arrived_india','indian_customs',
          'customs_cleared','at_vashi_warehouse','qc_check',
          'handed_to_courier','exception'
        ));
    end if;
  end;
end $$;

-- 3d. Migration: widen shipping_days from 1-30 to 1-90 on an already-existing
-- table, so ocean freight orders (34-46 real transit days) can actually be
-- created — the original 1-30 constraint only fit air freight. Named
-- constraint from the create-table statement above; falls back to the
-- Postgres-generated default name for tables created before this migration
-- existed, since ALTER TABLE ... DROP CONSTRAINT needs the real name.
do $$
declare
  existing_constraint text;
begin
  select conname into existing_constraint
  from pg_constraint
  where conrelid = 'public.dropy_orders'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%shipping_days%';

  if existing_constraint is not null and existing_constraint <> 'dropy_orders_shipping_days_check' then
    execute format('alter table public.dropy_orders drop constraint %I', existing_constraint);
    alter table public.dropy_orders add constraint dropy_orders_shipping_days_check
      check (shipping_days between 1 and 90);
  end if;
end $$;

-- 3e. Raw webhook capture — app/api/webhooks/shiprocket and .../velocity
-- write every received payload here verbatim (not parsed into
-- dropy_orders yet) because neither platform's real payload field names
-- are confirmed anywhere publicly documented. Read these back after
-- triggering each platform's real "Test Webhook" to see the actual shape,
-- then update the route handlers to parse real fields and stop just
-- logging. RLS below intentionally grants nothing to anon/authenticated —
-- same reasoning as dropy_orders: only the service-role webhook routes
-- read/write this, never the browser.
create table if not exists public.captured_shiprocket_webhooks (
  id          uuid primary key default gen_random_uuid(),
  payload     jsonb not null,
  headers     jsonb not null default '{}',
  received_at timestamptz not null default now()
);

create table if not exists public.captured_velocity_webhooks (
  id          uuid primary key default gen_random_uuid(),
  payload     jsonb not null,
  headers     jsonb not null default '{}',
  received_at timestamptz not null default now()
);

alter table public.captured_shiprocket_webhooks enable row level security;
alter table public.captured_velocity_webhooks   enable row level security;

-- 4. Indexes
create index if not exists dropy_orders_tracking_idx on public.dropy_orders (tracking_id);
create index if not exists dropy_orders_mobile_idx on public.dropy_orders (customer_mobile);
create index if not exists dropy_orders_dropy_id_idx on public.dropy_orders (dropy_order_id);
create index if not exists dropy_events_order_idx on public.dropy_order_events (order_id, sort_order);
create index if not exists captured_shiprocket_webhooks_received_idx on public.captured_shiprocket_webhooks (received_at desc);
create index if not exists captured_velocity_webhooks_received_idx on public.captured_velocity_webhooks (received_at desc);

-- 5. Auto-update
create or replace function public.dropy_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists dropy_orders_updated on public.dropy_orders;
create trigger dropy_orders_updated
  before update on public.dropy_orders
  for each row execute function public.dropy_touch_updated_at();

-- 6. RLS
--
-- The anon key (NEXT_PUBLIC_SUPABASE_ANON_KEY) ships in every page's client
-- bundle — it is PUBLIC. Previously this table granted it unrestricted
-- select/insert/update/delete on orders (full customer PII: names, phone
-- numbers, addresses) and select on admin_users (including password_hash).
-- Anyone with the anon key — i.e. anyone — could read every customer's
-- record or take over the admin account directly via the Supabase REST API,
-- with no server code involved at all.
--
-- Fix: grant the anon/authenticated roles NO policies on any of these
-- tables. RLS is enabled with zero matching policies, so PostgREST denies
-- every anon/authenticated request outright. All real access — public
-- tracking lookups, the admin panel — goes through Next.js API routes
-- (app/api/track, app/api/admin/*) using the service-role key
-- (lib/supabase-admin.ts), which bypasses RLS by design and is never sent
-- to the browser. Authorization (matching tracking ID + phone, requiring an
-- admin session) is enforced in that server code instead of in RLS.
alter table public.dropy_orders       enable row level security;
alter table public.dropy_order_events enable row level security;
alter table public.admin_users        enable row level security;

-- Drop the old permissive policies if this script is re-run against a
-- database that still has them from before this fix.
drop policy if exists "read_orders"   on public.dropy_orders;
drop policy if exists "read_events"   on public.dropy_order_events;
drop policy if exists "read_admins"   on public.admin_users;
drop policy if exists "insert_orders" on public.dropy_orders;
drop policy if exists "update_orders" on public.dropy_orders;
drop policy if exists "delete_orders" on public.dropy_orders;
drop policy if exists "insert_events" on public.dropy_order_events;
drop policy if exists "update_events" on public.dropy_order_events;
drop policy if exists "delete_events" on public.dropy_order_events;

-- No create policy statements follow — that's intentional, not an omission.

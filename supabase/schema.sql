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

  shipping_days     integer not null default 10 check (shipping_days between 1 and 30),
  shipping_mode     text not null default 'Air Freight'
                      check (shipping_mode in ('Air Freight','Express Air','Ocean Freight')),

  current_stage     text not null default 'order_placed'
                      check (current_stage in (
                        'order_placed','processing','packed','dispatched',
                        'at_us_airport','us_customs_cleared','in_transit_departed',
                        'mid_transit','arrived_india','indian_customs',
                        'customs_cleared','at_vashi_warehouse','qc_check','exception'
                      )),
  status            text not null default 'Order Placed'
                      check (status in (
                        'Order Placed','Processing','In Transit',
                        'Customs Clearance','At Warehouse','Received'
                      )),
  progress          integer not null default 0 check (progress between 0 and 100),

  order_date        timestamptz not null default now(),
  estimated_delivery text not null default '',
  actual_delivery   timestamptz,

  admin_notes       text,
  carrier_name      text default 'Dropy Logistics',
  awb_number        text,

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
                 'customs_cleared','at_vashi_warehouse','qc_check','exception'
               )),
  label        text not null,
  location     text not null,
  happened_at  text not null,
  note         text,
  state        text not null check (state in ('done','current','pending','exception')),
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);

-- 4. Indexes
create index if not exists dropy_orders_tracking_idx on public.dropy_orders (tracking_id);
create index if not exists dropy_orders_mobile_idx on public.dropy_orders (customer_mobile);
create index if not exists dropy_orders_dropy_id_idx on public.dropy_orders (dropy_order_id);
create index if not exists dropy_events_order_idx on public.dropy_order_events (order_id, sort_order);

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

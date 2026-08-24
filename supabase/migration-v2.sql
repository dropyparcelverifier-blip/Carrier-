-- ═══════════════════════════════════════════════════════════════════
-- DotConnects Carrier — Migration v2
-- Idempotent: safe to re-run (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)
-- Run BEFORE deploying the matching code — all columns are nullable,
-- so old code ignores them.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. New columns on dropy_orders ───────────────────────────────

alter table public.dropy_orders
  add column if not exists clock_anchor_stage    text,
  add column if not exists clock_anchor_at       timestamptz,
  add column if not exists deleted_at            timestamptz,
  add column if not exists deleted_by            uuid references public.admin_users(id),
  add column if not exists replacement_of        uuid references public.dropy_orders(id),
  add column if not exists label_generated_at    timestamptz,
  add column if not exists picked_up_at          timestamptz,
  add column if not exists delivered_at          timestamptz,
  add column if not exists shopify_order_id      text,
  add column if not exists shopify_fulfillment_id text,
  add column if not exists shopify_synced_at     timestamptz,
  add column if not exists shopify_sync_error    text;


-- ── 2. Roles + active flag on admin_users ────────────────────────

alter table public.admin_users
  add column if not exists role       text not null default 'staff'
                                        check (role in ('admin','staff')),
  add column if not exists is_active  boolean not null default true,
  add column if not exists created_by uuid references public.admin_users(id);


-- ── 3. Promote the seeded admin row ──────────────────────────────

update public.admin_users
  set role = 'admin'
  where username = 'admin' and role = 'staff';


-- ── 4. Audit log table ──────────────────────────────────────────

create table if not exists public.admin_audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_type  text not null default 'user' check (actor_type in ('user','system')),
  actor_id    uuid references public.admin_users(id),
  actor_name  text not null,
  action      text not null check (action in (
                'order.create','order.update','order.stage_change','order.delete',
                'order.restore','order.mark_damaged','order.mark_delivered',
                'order.add_days','order.mark_delayed','order.tracking_generated',
                'user.create','user.update','user.deactivate','seed.run'
              )),
  order_id    uuid references public.dropy_orders(id),
  before      jsonb,
  after       jsonb,
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists admin_audit_log_order_idx
  on public.admin_audit_log(order_id, created_at desc);
create index if not exists admin_audit_log_actor_idx
  on public.admin_audit_log(actor_id, created_at desc);


-- ── 5. RLS on audit log (zero policies = anon gets nothing) ─────

alter table public.admin_audit_log enable row level security;


-- ── 6. Widen CHECK constraints to include 'damaged' ─────────────
-- These DROP + ADD pairs are idempotent: if the constraint already
-- includes 'damaged' the DROP succeeds (same name) and the ADD
-- recreates it identically.

do $$
declare
  stage_constraint text;
begin
  -- dropy_orders.current_stage
  select constraint_name into stage_constraint
    from information_schema.table_constraints
    where table_name = 'dropy_orders'
      and constraint_type = 'CHECK'
      and constraint_name like '%current_stage%'
    limit 1;

  if stage_constraint is not null then
    execute format('alter table public.dropy_orders drop constraint %I', stage_constraint);
  end if;

  alter table public.dropy_orders add constraint dropy_orders_current_stage_check
    check (current_stage in (
      'order_placed','processing','packed','dispatched',
      'at_us_airport','us_customs_cleared','in_transit_departed',
      'mid_transit','arrived_india','indian_customs',
      'customs_cleared','at_vashi_warehouse','qc_check',
      'handed_to_courier','exception','damaged'
    ));

  -- dropy_order_events.stage
  select constraint_name into stage_constraint
    from information_schema.table_constraints
    where table_name = 'dropy_order_events'
      and constraint_type = 'CHECK'
      and constraint_name like '%stage%'
    limit 1;

  if stage_constraint is not null then
    execute format('alter table public.dropy_order_events drop constraint %I', stage_constraint);
  end if;

  alter table public.dropy_order_events add constraint dropy_order_events_stage_check
    check (stage in (
      'order_placed','processing','packed','dispatched',
      'at_us_airport','us_customs_cleared','in_transit_departed',
      'mid_transit','arrived_india','indian_customs',
      'customs_cleared','at_vashi_warehouse','qc_check',
      'handed_to_courier','exception','damaged'
    ));
end $$;

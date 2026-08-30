-- ═══════════════════════════════════════════════════════════════════
-- Migration v5 — captured courier webhooks
--
-- Both webhook routes write here. Shiprocket's has been parsed for a
-- while; Velocity's is parsed as of this migration, but BOTH still
-- capture every request in full.
--
-- Capture is not debris. When a courier changes a field name or adds a
-- status, the captured rows are the only evidence of what actually
-- arrived — the docs describe intent, these describe reality.
--
-- Idempotent. Run after migration-v4.sql.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.captured_velocity_webhooks (
  id          uuid primary key default gen_random_uuid(),
  received_at timestamptz not null default now(),
  payload     jsonb not null,
  headers     jsonb
);

create table if not exists public.captured_shiprocket_webhooks (
  id          uuid primary key default gen_random_uuid(),
  received_at timestamptz not null default now(),
  payload     jsonb not null,
  headers     jsonb
);

-- Idempotency lookup. Velocity's docs recommend deduplicating on
-- event_id, and the route checks this table for a prior occurrence —
-- without the index that's a full scan on every webhook.
create index if not exists captured_velocity_event_id_idx
  on public.captured_velocity_webhooks ((payload->>'event_id'));

create index if not exists captured_velocity_received_idx
  on public.captured_velocity_webhooks (received_at desc);

create index if not exists captured_shiprocket_received_idx
  on public.captured_shiprocket_webhooks (received_at desc);

-- ── RLS ──────────────────────────────────────────────────────────
-- Enabled with no policies, like every other table here. The anon key
-- can do nothing; the webhook routes hold the service-role key.
--
-- These payloads carry consignee names, phone numbers and addresses.
alter table public.captured_velocity_webhooks enable row level security;
alter table public.captured_shiprocket_webhooks enable row level security;

-- ── Verification ─────────────────────────────────────────────────
--   select count(*) from public.captured_velocity_webhooks;
--
--   -- what has Velocity actually sent?
--   select payload->'data'->>'status'        as status,
--          payload->'data'->>'shipment_type' as type,
--          count(*)
--   from public.captured_velocity_webhooks
--   group by 1, 2 order by 3 desc;

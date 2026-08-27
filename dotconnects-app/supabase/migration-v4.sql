-- ═══════════════════════════════════════════════════════════════════
-- Migration v4 — business enquiries
--
-- The query form on the marketing site. Enquiries land here, the team
-- works them, and they're shared with the cargo partner per the data
-- agreement.
--
-- Idempotent. Run after migration-v3.sql.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.business_queries (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),

  -- What the enquirer told us
  business_name  text not null,
  business_desc  text,
  contact_name   text,
  email          text not null,
  phone          text,
  subject        text not null,
  body           text not null,

  -- Workflow: open -> in_progress -> resolved
  status         text not null default 'open'
                 check (status in ('open', 'in_progress', 'resolved', 'spam')),
  assigned_to    uuid references public.admin_users(id) on delete set null,
  internal_note  text,
  resolved_at    timestamptz,

  -- Shared with the cargo partner? Set when the team forwards it.
  shared_at      timestamptz,

  -- Captured for abuse handling, never displayed
  source_ip      text,
  user_agent     text
);

-- The admin list is "open first, newest first" almost every time.
create index if not exists business_queries_status_idx
  on public.business_queries (status, created_at desc);

create index if not exists business_queries_email_idx
  on public.business_queries (lower(email));

-- ── RLS ──────────────────────────────────────────────────────────
--
-- Enabled with NO policies, exactly like dropy_orders. The anon key can
-- do nothing at all; every read and write goes through a server route
-- holding the service-role key.
--
-- This matters more here than elsewhere: the table holds names, emails
-- and phone numbers of people who filled in a form. A permissive policy
-- would expose a marketing list.
alter table public.business_queries enable row level security;

-- ── Rate limiting ────────────────────────────────────────────────
--
-- A public form with no gate gets scraped and spammed. Rather than a
-- CAPTCHA — which costs a third-party script on every page load — the
-- insert path checks this view and refuses more than 3 from one email or
-- 10 from one IP per hour.
create or replace view public.business_queries_recent
with (security_invoker = true)
as
select email, source_ip, created_at
from public.business_queries
where created_at > now() - interval '1 hour';

-- ── Verification ─────────────────────────────────────────────────
--   select count(*) from public.business_queries;
--   select status, count(*) from public.business_queries group by status;

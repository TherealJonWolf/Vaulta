-- Enums
do $$ begin
  create type public.signal_category as enum (
    'device_consistency',
    'geolocation_context',
    'behavioral_pattern',
    'utility_corroboration',
    'cross_account',
    'identity_verification',
    'document_consistency'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.signal_direction as enum ('positive','neutral','negative');
exception when duplicate_object then null; end $$;

-- trust_signals: normalized projection ledger
create table if not exists public.trust_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  category public.signal_category not null,
  direction public.signal_direction not null,
  weight numeric(5,2) not null default 0,
  confidence numeric(3,2) not null default 0.5,
  source_table text not null,
  source_id uuid,
  rule_id text,
  summary text not null,
  evaluated_at timestamptz not null default now(),
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.trust_signals enable row level security;

create policy "Users view own trust signals"
  on public.trust_signals for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Admins view all trust signals"
  on public.trust_signals for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role));

-- No INSERT/UPDATE/DELETE policies for clients. Service role only.

create index if not exists trust_signals_user_evaluated_idx
  on public.trust_signals (user_id, evaluated_at desc);
create index if not exists trust_signals_category_idx
  on public.trust_signals (user_id, category, evaluated_at desc);

-- signal_consents: per-category opt-in
create table if not exists public.signal_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  category public.signal_category not null,
  granted boolean not null default false,
  granted_at timestamptz,
  revoked_at timestamptz,
  consent_text_hash text not null,
  source text not null default 'vault_settings',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, category)
);

alter table public.signal_consents enable row level security;

create policy "Users view own signal consents"
  on public.signal_consents for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users insert own signal consents"
  on public.signal_consents for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users update own signal consents"
  on public.signal_consents for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Admins can read all consent state for compliance review
create policy "Admins view all signal consents"
  on public.signal_consents for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role));

create index if not exists signal_consents_user_idx
  on public.signal_consents (user_id);

-- Auto-update updated_at on signal_consents
drop trigger if exists trg_signal_consents_updated_at on public.signal_consents;
create trigger trg_signal_consents_updated_at
  before update on public.signal_consents
  for each row execute function public.update_updated_at_column();

-- Extend device_integrity_factors with two new sub-scores (default 0, non-breaking)
alter table public.device_integrity_factors
  add column if not exists geolocation_consistency_score integer not null default 0,
  add column if not exists behavioral_consistency_score integer not null default 0;
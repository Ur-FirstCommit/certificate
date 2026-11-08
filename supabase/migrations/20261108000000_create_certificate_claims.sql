create table if not exists public.certificate_winners (
  email text primary key check (email = lower(btrim(email))),
  award_name text not null check (length(btrim(award_name)) between 1 and 120),
  created_at timestamptz not null default now()
);

create table if not exists public.certificate_claims (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  email text not null unique check (email = lower(btrim(email))),
  full_name text not null check (length(btrim(full_name)) between 2 and 100),
  certificate_type text not null check (certificate_type in ('award', 'participation')),
  award_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint certificate_claims_award_consistency check (
    (certificate_type = 'award' and award_name is not null and length(btrim(award_name)) > 0)
    or (certificate_type = 'participation' and award_name is null)
  )
);

alter table public.certificate_winners enable row level security;
alter table public.certificate_claims enable row level security;

revoke all on public.certificate_winners from anon, authenticated;
revoke all on public.certificate_claims from anon, authenticated;

comment on table public.certificate_winners is 'Private source of award eligibility. Read only by the claim Edge Function.';
comment on table public.certificate_claims is 'One current certificate claim per verified email address.';

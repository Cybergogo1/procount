-- ProCount V1 — initial schema (build brief Section 5).
-- Tables: profiles, sessions, scans. RLS on all three. Trigger to create a
-- profile on signup, and a helper to enforce one active session per user.

-- ---------------------------------------------------------------------------
-- profiles — extends auth.users, one row per user.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  trial_started_at timestamptz not null default now(),
  has_used_first_export boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- sessions — a counting session. One active session per user at a time.
-- ---------------------------------------------------------------------------
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'completed')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  export_email text,
  exported_at timestamptz,
  created_at timestamptz not null default now()
);
create index sessions_user_id_status_idx on public.sessions (user_id, status);

-- ---------------------------------------------------------------------------
-- scans — the actual count rows. Flat structure per the brief.
-- ---------------------------------------------------------------------------
create table public.scans (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  barcode text not null,
  quantity integer not null default 1 check (quantity > 0),
  scanned_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index scans_session_id_scanned_at_idx on public.scans (session_id, scanned_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.sessions enable row level security;
alter table public.scans enable row level security;

-- profiles: a user can select and update only their own row.
create policy "Profiles are viewable by owner"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Profiles are updatable by owner"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- sessions: full CRUD restricted to the owner.
create policy "Sessions selectable by owner"
  on public.sessions for select
  using (auth.uid() = user_id);

create policy "Sessions insertable by owner"
  on public.sessions for insert
  with check (auth.uid() = user_id);

create policy "Sessions updatable by owner"
  on public.sessions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Sessions deletable by owner"
  on public.sessions for delete
  using (auth.uid() = user_id);

-- scans: full CRUD restricted to the owner.
create policy "Scans selectable by owner"
  on public.scans for select
  using (auth.uid() = user_id);

create policy "Scans insertable by owner"
  on public.scans for insert
  with check (auth.uid() = user_id);

create policy "Scans updatable by owner"
  on public.scans for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Scans deletable by owner"
  on public.scans for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- handle_new_user — create a profile row whenever an auth user is created.
-- trial_started_at defaults to now() via the column default (brief Section 6).
-- ---------------------------------------------------------------------------
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- ensure_one_active_session — on new active session, complete any others.
-- Runs as a BEFORE INSERT trigger so the incoming row stays 'active' and all
-- previously-active sessions for the same user are flipped to 'completed'
-- (brief Section 5: one active session per user at a time).
-- ---------------------------------------------------------------------------
create function public.ensure_one_active_session()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'active' then
    update public.sessions
      set status = 'completed',
          ended_at = coalesce(ended_at, now())
    where user_id = new.user_id
      and status = 'active'
      and id <> new.id;
  end if;
  return new;
end;
$$;

create trigger sessions_ensure_one_active
  before insert on public.sessions
  for each row
  execute function public.ensure_one_active_session();

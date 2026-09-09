-- Fix anonymous sign-in (Apple review "login wall", Sep 2026).
--
-- The account-free rework signs every new user in anonymously. Anonymous users
-- have no email, but profiles.email was NOT NULL and the handle_new_user trigger
-- inserted new.email — so the profile insert threw and the whole sign-up failed
-- with a 500 ("Database error creating anonymous user"). Every FRESH install
-- (Apple's reviewer, and every real customer) then fell back to the login screen.
-- Earlier testers never hit it because their devices still held old
-- email/password sessions, so the anonymous path never ran.
--
-- Fix: allow a null email, and never let a profile-row error block sign-in.
alter table public.profiles alter column email drop not null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
exception
  when others then
    -- Auth must never fail on a profile-row problem (e.g. anonymous users).
    return new;
end;
$$;

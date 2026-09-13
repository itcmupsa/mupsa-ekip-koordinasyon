-- Per-user theme colour preference. The client retains the application default
-- when this table has no row for the signed-in profile.

create table public.user_theme_preferences (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  updated_at timestamptz not null default now()
);

create or replace function public.enforce_user_theme_preference_profile_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.profile_id is distinct from old.profile_id then
    raise exception 'Theme preference owner cannot be changed.' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger user_theme_preferences_profile_id_immutable
before update on public.user_theme_preferences
for each row execute function public.enforce_user_theme_preference_profile_id();

create trigger user_theme_preferences_set_updated_at
before update on public.user_theme_preferences
for each row execute function public.set_updated_at();

alter table public.user_theme_preferences enable row level security;

create policy "active users read own theme preference"
on public.user_theme_preferences for select
using (
  profile_id = auth.uid()
  and public.is_active_member()
);

create policy "active users create own theme preference"
on public.user_theme_preferences for insert
with check (
  profile_id = auth.uid()
  and public.is_active_member()
);

create policy "active users update own theme preference"
on public.user_theme_preferences for update
using (
  profile_id = auth.uid()
  and public.is_active_member()
)
with check (
  profile_id = auth.uid()
  and public.is_active_member()
);

-- This is a small, explicit Data API surface. Theme preferences are private
-- and client deletion is intentionally not part of the contract.
revoke all on public.user_theme_preferences from anon, authenticated;
grant select, insert, update on public.user_theme_preferences to authenticated;

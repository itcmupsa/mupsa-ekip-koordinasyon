-- Dönem bazlı görünen kullanıcı adı.
-- Aynı Auth/profil hesabı farklı dönemlerde farklı adla gösterilebilir.

alter table public.period_memberships
  add column if not exists period_display_name text;

-- Mevcut üyeliklerdeki ilk görünen adı profil kaydından taşı.
-- Backfill audit geçmişine kullanıcı işlemi gibi yazılmamalı.
alter table public.period_memberships disable trigger user;

update public.period_memberships pm
set period_display_name = trim(p.display_name)
from public.profiles p
where p.id = pm.profile_id
  and (pm.period_display_name is null or char_length(trim(pm.period_display_name)) = 0);

alter table public.period_memberships enable trigger user;

alter table public.period_memberships
  alter column period_display_name set not null;

alter table public.period_memberships
  drop constraint if exists period_memberships_display_name_check;

alter table public.period_memberships
  add constraint period_memberships_display_name_check
  check (char_length(trim(period_display_name)) > 0);

-- Dönem kilitlendikten sonra o dönemin üyelik adı, rolü ve aktifliği değiştirilemez.
create or replace function public.assert_period_membership_period_unlocked()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_period_id uuid;
begin
  target_period_id := case when tg_op = 'DELETE' then old.period_id else new.period_id end;

  if public.is_period_locked(target_period_id) then
    raise exception 'Bu dönem kilitli olduğu için üyelik değiştirilemez.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists period_memberships_assert_period_unlocked on public.period_memberships;
create trigger period_memberships_assert_period_unlocked
before insert or update or delete on public.period_memberships
for each row execute function public.assert_period_membership_period_unlocked();

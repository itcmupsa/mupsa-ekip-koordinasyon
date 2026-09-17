-- PR calendar management is a person-level permission, independent from the
-- member's coordinator role. Super admins keep their platform-wide access.
create table public.pr_calendar_permissions (
  period_id uuid not null references public.periods(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  can_manage boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (period_id, profile_id)
);

create trigger pr_calendar_permissions_set_updated_at
before update on public.pr_calendar_permissions
for each row execute function public.set_updated_at();

alter table public.pr_calendar_permissions enable row level security;
revoke all on public.pr_calendar_permissions from anon, authenticated;

comment on table public.pr_calendar_permissions is
  'Explicit person-level PR calendar management permission. Coordinator roles are unchanged.';

create or replace function public.can_manage_pr_calendar(target_period_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.periods period_record
    join public.period_memberships membership
      on membership.period_id = period_record.id
     and membership.profile_id = auth.uid()
     and membership.is_active
    join public.profiles profile_record
      on profile_record.id = membership.profile_id
     and profile_record.is_active
    left join public.pr_calendar_permissions permission
      on permission.period_id = membership.period_id
     and permission.profile_id = membership.profile_id
    where period_record.id = target_period_id
      and period_record.is_active
      and (
        membership.app_role = 'super_admin'
        or coalesce(permission.can_manage, false)
      )
  );
$$;

do $$
declare
  beyza_membership_id constant uuid := '41a65f87-cd23-4746-a647-0fc87543ee28';
  ezgi_membership_id constant uuid := '74547c6e-1ec4-41da-a918-09d38fd044ff';
begin
  insert into public.pr_calendar_permissions (period_id, profile_id, can_manage)
  select membership.period_id, membership.profile_id, false
  from public.period_memberships membership
  join public.periods period_record on period_record.id = membership.period_id
  where membership.id = beyza_membership_id
    and membership.is_active
    and period_record.is_active;
  if not found then
    raise exception 'Beyza ÇALIŞIR için aktif dönem üyeliği bulunamadı.';
  end if;

  insert into public.pr_calendar_permissions (period_id, profile_id, can_manage)
  select membership.period_id, membership.profile_id, true
  from public.period_memberships membership
  join public.periods period_record on period_record.id = membership.period_id
  where membership.id = ezgi_membership_id
    and membership.is_active
    and period_record.is_active;
  if not found then
    raise exception 'Ezgi ÖZDÜZENCİLER için aktif dönem üyeliği bulunamadı.';
  end if;
end;
$$;

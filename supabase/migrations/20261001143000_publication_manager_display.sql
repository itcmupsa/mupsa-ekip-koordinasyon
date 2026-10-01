-- Public team identity only: expose explicit PR manager display names, never
-- the internal permission table or Auth details. Existing write grants unchanged.
create function public.get_pr_publication_managers(target_period_id uuid)
returns table (profile_id uuid, display_name text)
language sql
stable
security definer
set search_path = public
as $$
  select pm.profile_id, pm.period_display_name
  from public.pr_calendar_permissions perm
  join public.period_memberships pm on pm.period_id = perm.period_id and pm.profile_id = perm.profile_id
  join public.profiles profile on profile.id = pm.profile_id
  where perm.period_id = target_period_id and perm.can_manage
    and pm.is_active and profile.is_active
    and public.is_active_member_of_period(target_period_id, auth.uid())
  order by pm.period_display_name;
$$;
revoke all on function public.get_pr_publication_managers(uuid) from public, anon;
grant execute on function public.get_pr_publication_managers(uuid) to authenticated;

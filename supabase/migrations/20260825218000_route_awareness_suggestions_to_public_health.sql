-- MUPİ farkındalık içerik önerilerini Halk Sağlığı Koordinatörüne yönlendir.

create or replace function public.can_access_awareness_ai_suggestions(target_period_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.period_memberships membership
    join public.profiles profile on profile.id = membership.profile_id and profile.is_active
    left join public.coordinator_roles role on role.id = membership.coordinator_role_id
    join public.periods period on period.id = membership.period_id and period.is_active
    where membership.profile_id = auth.uid()
      and membership.period_id = target_period_id
      and membership.is_active
      and (membership.app_role = 'super_admin' or role.slug = 'public-health-coordinator')
  );
$$;

revoke all on function public.can_access_awareness_ai_suggestions(uuid) from public;
grant execute on function public.can_access_awareness_ai_suggestions(uuid) to authenticated;

-- Daha önce üretilmiş ve henüz sonuçlandırılmamış önerileri de yeni alıcıya bildir.
insert into public.notifications (
  recipient_id,
  notification_type,
  channel,
  title,
  body,
  metadata,
  dedupe_key
)
select
  membership.profile_id,
  'awareness_ai_suggestion',
  'in_app',
  'MUPİ içerik önerisi',
  format(
    '%s için eczacılık odaklı içerik önerisi hazırlandı.',
    coalesce(nullif(suggestion.payload ->> 'name', ''), 'Yaklaşan önemli gün')
  ),
  jsonb_build_object(
    'awareness_suggestion_id', suggestion.id,
    'url', '/app/farkindalik?suggestion=' || suggestion.id::text
  ),
  format('awareness-ai-suggestion:%s:%s:in_app', suggestion.id, membership.profile_id)
from public.ai_awareness_suggestions suggestion
join public.periods period
  on period.id = suggestion.period_id
 and period.is_active
join public.period_memberships membership
  on membership.period_id = suggestion.period_id
 and membership.is_active
join public.profiles profile
  on profile.id = membership.profile_id
 and profile.is_active
join public.coordinator_roles role
  on role.id = membership.coordinator_role_id
 and role.slug = 'public-health-coordinator'
where suggestion.status in ('new', 'seen')
  and suggestion.target_date >= current_date
on conflict (dedupe_key) where dedupe_key is not null do nothing;

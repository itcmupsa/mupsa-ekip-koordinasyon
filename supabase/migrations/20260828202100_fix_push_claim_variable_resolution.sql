-- Existing push claim function has OUT parameter names that overlap with CTE column names.
-- Prefer table/CTE columns when PL/pgSQL resolves those ambiguous references.

create or replace function public.claim_push_notification_deliveries(p_limit integer default 50)
returns table (
  delivery_id uuid,
  delivery_claim_token uuid,
  notification_id uuid,
  recipient_id uuid,
  event_id uuid,
  task_id uuid,
  title text,
  body text,
  metadata jsonb,
  subscription_id uuid,
  endpoint text,
  p256dh_key text,
  auth_key text,
  content_encoding text,
  attempt_count integer
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  affected_notification_ids uuid[];
begin
  if p_limit is null or p_limit < 1 or p_limit > 200 then
    raise exception 'Gecersiz claim limiti.' using errcode = '22023';
  end if;

  with recovered as (
    update public.push_notification_deliveries d
    set delivery_state = 'transient_failed',
        next_attempt_at = now(),
        processing_started_at = null,
        claim_token = null,
        last_error_code = coalesce(last_error_code, 'processing_lease_expired'),
        last_error = coalesce(last_error, 'Onceki teslim worker islemi tamamlayamadi; kayit tekrar kuyruga alindi.')
    where d.delivery_state = 'processing'
      and d.processing_started_at < now() - interval '10 minutes'
    returning d.notification_id
  )
  select array_agg(distinct notification_id) into affected_notification_ids from recovered;

  if affected_notification_ids is not null then
    perform public.refresh_push_notification_delivery_status(notification_id)
    from unnest(affected_notification_ids) as recovered_ids(notification_id);
  end if;

  insert into public.push_notification_deliveries (
    notification_id,
    subscription_id,
    recipient_id,
    delivery_state,
    next_attempt_at
  )
  select
    n.id,
    s.id,
    n.recipient_id,
    'pending',
    greatest(n.scheduled_for, now())
  from public.notifications n
  join public.push_subscriptions s
    on s.profile_id = n.recipient_id
   and s.is_active
  where n.channel = 'push'
    and n.delivery_status = 'queued'
    and n.scheduled_for <= now()
  on conflict (notification_id, subscription_id) do nothing;

  with deactivated as (
    update public.push_notification_deliveries d
    set delivery_state = 'permanent_failed',
        processing_started_at = null,
        claim_token = null,
        last_error_code = coalesce(last_error_code, 'subscription_inactive_or_reassigned'),
        last_error = coalesce(last_error, 'Push aboneligi artik bu bildirim alicisina ait degil.')
    from public.push_subscriptions s, public.notifications n
    where d.subscription_id = s.id
      and d.notification_id = n.id
      and (not s.is_active or s.profile_id <> n.recipient_id)
      and d.delivery_state in ('pending', 'transient_failed')
    returning d.notification_id
  )
  select array_agg(distinct notification_id) into affected_notification_ids from deactivated;

  if affected_notification_ids is not null then
    perform public.refresh_push_notification_delivery_status(notification_id)
    from unnest(affected_notification_ids) as inactive_ids(notification_id);
  end if;

  update public.notifications n
  set delivery_status = 'failed',
      metadata = n.metadata || jsonb_build_object(
        'delivery_error_code', 'no_active_subscription',
        'delivery_error', 'Kullanicinin aktif PWA bildirim aboneligi bulunmuyor.'
      )
  where n.channel = 'push'
    and n.delivery_status = 'queued'
    and n.scheduled_for <= now()
    and not exists (
      select 1 from public.push_subscriptions s
      where s.profile_id = n.recipient_id and s.is_active
    )
    and not exists (
      select 1 from public.push_notification_deliveries d
      where d.notification_id = n.id
    );

  return query
  with picked as (
    select d.id
    from public.push_notification_deliveries d
    join public.notifications n on n.id = d.notification_id
    join public.push_subscriptions s on s.id = d.subscription_id
    where n.channel = 'push'
      and n.delivery_status = 'queued'
      and n.scheduled_for <= now()
      and s.is_active
      and s.profile_id = n.recipient_id
      and d.delivery_state in ('pending', 'transient_failed')
      and d.next_attempt_at <= now()
    order by d.next_attempt_at, d.created_at
    for update of d skip locked
    limit p_limit
  ), claimed as (
    update public.push_notification_deliveries d
    set delivery_state = 'processing',
        attempt_count = d.attempt_count + 1,
        processing_started_at = now(),
        claim_token = gen_random_uuid()
    from picked
    where d.id = picked.id
    returning d.*
  )
  select
    c.id,
    c.claim_token,
    n.id,
    n.recipient_id,
    n.event_id,
    n.task_id,
    n.title,
    n.body,
    n.metadata,
    s.id,
    s.endpoint,
    s.p256dh_key,
    s.auth_key,
    s.content_encoding,
    c.attempt_count
  from claimed c
  join public.notifications n on n.id = c.notification_id
  join public.push_subscriptions s on s.id = c.subscription_id;
end;
$$;

revoke all on function public.claim_push_notification_deliveries(integer) from public;
grant execute on function public.claim_push_notification_deliveries(integer) to service_role;

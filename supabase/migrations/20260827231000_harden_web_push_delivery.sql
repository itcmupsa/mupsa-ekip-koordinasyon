-- PWA/Web Push guvenilirlik ve guvenlik sertlestirmesi.
-- Gercek deploy bu migration ile bu asamada yapilmayacaktir.

-- 1) Kullanici kendi subscription materyalini gorebilir; Super Yonetici diger
-- kullanicilarin endpoint/p256dh/auth degerlerini okuyamaz. Service role RLS'yi bypass eder.
drop policy if exists "users and admins read push subscriptions" on public.push_subscriptions;
drop policy if exists "users and admins update push subscriptions" on public.push_subscriptions;
drop policy if exists "users and admins remove push subscriptions" on public.push_subscriptions;

create policy "users read own push subscriptions"
  on public.push_subscriptions for select
  using (profile_id = auth.uid());

create policy "users update own push subscriptions"
  on public.push_subscriptions for update
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

create policy "users remove own push subscriptions"
  on public.push_subscriptions for delete
  using (profile_id = auth.uid());

-- Ayni browser endpoint'i onceki kullaniciya ait kalmis olsa bile, yeni oturum
-- endpoint + anahtar materyalini biliyorsa mevcut satiri atomik olarak kendi profiline
-- devredebilir. Bu, A logout -> B login senaryosunda eski profile push sizintisini onler.
create or replace function public.sync_push_subscription(
  p_endpoint text,
  p_p256dh_key text,
  p_auth_key text,
  p_content_encoding text default 'aes128gcm',
  p_device_label text default null,
  p_user_agent text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  subscription_id uuid;
begin
  if auth.uid() is null or not public.is_active_member() then
    raise exception 'Aktif uyelik gerekli.' using errcode = '42501';
  end if;

  if nullif(trim(p_endpoint), '') is null
    or nullif(trim(p_p256dh_key), '') is null
    or nullif(trim(p_auth_key), '') is null then
    raise exception 'Push aboneligi eksik bilgi iceriyor.' using errcode = '22023';
  end if;

  insert into public.push_subscriptions (
    profile_id,
    endpoint,
    p256dh_key,
    auth_key,
    content_encoding,
    device_label,
    user_agent,
    is_active,
    last_seen_at,
    failed_at
  )
  values (
    auth.uid(),
    trim(p_endpoint),
    trim(p_p256dh_key),
    trim(p_auth_key),
    coalesce(nullif(trim(p_content_encoding), ''), 'aes128gcm'),
    nullif(trim(p_device_label), ''),
    nullif(trim(p_user_agent), ''),
    true,
    now(),
    null
  )
  on conflict (endpoint) do update
  set profile_id = excluded.profile_id,
      p256dh_key = excluded.p256dh_key,
      auth_key = excluded.auth_key,
      content_encoding = excluded.content_encoding,
      device_label = excluded.device_label,
      user_agent = excluded.user_agent,
      is_active = true,
      last_seen_at = now(),
      failed_at = null
  returning id into subscription_id;

  return subscription_id;
end;
$$;

revoke all on function public.sync_push_subscription(text, text, text, text, text, text) from public;
grant execute on function public.sync_push_subscription(text, text, text, text, text, text) to authenticated;

-- 2) Bildirim alicisi sadece read_at alanini guncelleyebilir; title/body/status/
-- scheduled_for/metadata gibi sunucu alanlari istemciden degistirilemez.
drop policy if exists "recipients mark notifications read" on public.notifications;

create policy "recipients update own notification read state"
  on public.notifications for update
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

revoke update on table public.notifications from anon;
revoke update on table public.notifications from authenticated;
grant update (read_at) on table public.notifications to authenticated;

-- 3) Her notification + subscription cifti ayri teslim durumuna sahiptir.
create table if not exists public.push_notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  delivery_state text not null default 'pending' check (
    delivery_state in ('pending', 'processing', 'sent', 'transient_failed', 'permanent_failed')
  ),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz not null default now(),
  processing_started_at timestamptz,
  claim_token uuid,
  last_error_code text,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (notification_id, subscription_id)
);

create index if not exists push_notification_deliveries_due_idx
  on public.push_notification_deliveries(next_attempt_at, created_at)
  where delivery_state in ('pending', 'transient_failed');

create index if not exists push_notification_deliveries_processing_idx
  on public.push_notification_deliveries(processing_started_at)
  where delivery_state = 'processing';

create trigger push_notification_deliveries_set_updated_at
before update on public.push_notification_deliveries
for each row execute function public.set_updated_at();

alter table public.push_notification_deliveries enable row level security;
revoke all on table public.push_notification_deliveries from anon;
revoke all on table public.push_notification_deliveries from authenticated;

-- Notification aggregate durumu cihaz teslimlerinin toplamindan turetilir.
create or replace function public.refresh_push_notification_delivery_status(p_notification_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  has_delivery boolean;
  has_open_delivery boolean;
  has_sent_delivery boolean;
begin
  select
    count(*) > 0,
    bool_or(delivery_state in ('pending', 'processing', 'transient_failed')),
    bool_or(delivery_state = 'sent')
  into has_delivery, has_open_delivery, has_sent_delivery
  from public.push_notification_deliveries
  where notification_id = p_notification_id;

  if not has_delivery then
    return;
  end if;

  if coalesce(has_open_delivery, false) then
    update public.notifications
    set delivery_status = 'queued'
    where id = p_notification_id and channel = 'push';
  elsif coalesce(has_sent_delivery, false) then
    update public.notifications
    set delivery_status = 'sent',
        sent_at = coalesce(sent_at, now())
    where id = p_notification_id and channel = 'push';
  else
    update public.notifications
    set delivery_status = 'failed'
    where id = p_notification_id and channel = 'push';
  end if;
end;
$$;

revoke all on function public.refresh_push_notification_delivery_status(uuid) from public;

-- Atomik claim: once crash sonrasi 10 dakikadan eski processing kayitlarini geri kazanir,
-- sonra yeni cihaz teslimlerini materialize eder ve FOR UPDATE SKIP LOCKED ile tek worker'a verir.
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
declare
  affected_notification_ids uuid[];
begin
  if p_limit is null or p_limit < 1 or p_limit > 200 then
    raise exception 'Gecersiz claim limiti.' using errcode = '22023';
  end if;

  -- Crash/stall recovery.
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

  -- Kuyruktaki due notification'lar icin aktif her cihaz/subscription'a bir teslim kaydi.
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

  -- Sonradan pasiflesen veya baska profile yeniden atanan subscription'larin
  -- eski notification attempt'larini kalici kapat; eski kullanici verisi yeni
  -- kullanicinin cihazina gonderilmemelidir.
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

  -- Due olup hic aktif subscription'i olmayan notification'i sonsuza kadar queued birakma.
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

create or replace function public.finish_push_notification_delivery(
  p_delivery_id uuid,
  p_claim_token uuid,
  p_outcome text,
  p_next_attempt_at timestamptz default null,
  p_error_code text default null,
  p_error text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  target_notification_id uuid;
  updated_count integer;
begin
  if p_outcome not in ('sent', 'transient_failed', 'permanent_failed') then
    raise exception 'Gecersiz push teslim sonucu.' using errcode = '22023';
  end if;

  if p_outcome = 'transient_failed' and p_next_attempt_at is null then
    raise exception 'Transient hata icin sonraki deneme zamani gerekli.' using errcode = '22023';
  end if;

  update public.push_notification_deliveries d
  set delivery_state = p_outcome,
      next_attempt_at = case when p_outcome = 'transient_failed' then p_next_attempt_at else d.next_attempt_at end,
      processing_started_at = null,
      claim_token = null,
      last_error_code = p_error_code,
      last_error = case when p_error is null then null else left(p_error, 300) end,
      sent_at = case when p_outcome = 'sent' then now() else d.sent_at end
  where d.id = p_delivery_id
    and d.delivery_state = 'processing'
    and d.claim_token = p_claim_token
  returning d.notification_id into target_notification_id;

  get diagnostics updated_count = row_count;
  if updated_count = 0 then
    return false;
  end if;

  perform public.refresh_push_notification_delivery_status(target_notification_id);
  return true;
end;
$$;

revoke all on function public.finish_push_notification_delivery(uuid, uuid, text, timestamptz, text, text) from public;
grant execute on function public.finish_push_notification_delivery(uuid, uuid, text, timestamptz, text, text) to service_role;

-- Uygulanmış tema duyurusu fonksiyonunda, aynı release_key için eşzamanlı
-- çağrıların farklı hedef dönemleri sessizce kabul etmesini de engeller.

create or replace function public.queue_theme_release_announcement(target_period_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  theme_release_key constant text := 'user-theme-pwa-announcement-20260912';
  theme_title constant text := 'Tema rengini seçebilirsin';
  theme_body constant text := 'Ayarlar → Görünüm bölümünden uygulamanın rengini kişiselleştirebilirsin.';
  theme_target_url constant text := '/app/ayarlar?section=appearance';
  active_period_id uuid;
  release_id uuid;
  existing_release public.release_announcements%rowtype;
  recipient_ids uuid[];
  recipient_count integer;
begin
  if target_period_id is null then
    raise exception 'Tema duyurusu için hedef dönem zorunludur.' using errcode = '22023';
  end if;

  select id into active_period_id
  from public.periods
  where id = target_period_id
    and is_active;

  if active_period_id is null then
    raise exception 'Tema duyurusu hedef dönemi bulunamadı veya aktif değil.' using errcode = 'P0002';
  end if;

  select * into existing_release
  from public.release_announcements
  where release_key = theme_release_key;

  if found then
    if existing_release.period_id <> active_period_id then
      raise exception 'Tema duyurusu daha önce başka bir dönem için kuyruğa alındı.' using errcode = 'P0001';
    end if;
    return jsonb_build_object(
      'release_key', theme_release_key,
      'release_announcement_id', existing_release.id,
      'recipient_count', existing_release.recipient_count,
      'already_queued', true
    );
  end if;

  select coalesce(array_agg(distinct membership.profile_id), '{}'::uuid[])
  into recipient_ids
  from public.period_memberships membership
  join public.profiles profile on profile.id = membership.profile_id
  where membership.period_id = active_period_id
    and membership.is_active
    and profile.is_active;

  recipient_count := coalesce(cardinality(recipient_ids), 0);
  if recipient_count = 0 then
    raise exception 'Tema duyurusu için uygun aktif alıcı bulunamadı.' using errcode = 'P0002';
  end if;

  insert into public.release_announcements (
    release_key, period_id, queued_by, title, body, target_url, recipient_count
  )
  values (
    theme_release_key, active_period_id, auth.uid(), theme_title, theme_body,
    theme_target_url, recipient_count
  )
  on conflict (release_key) do nothing
  returning id into release_id;

  if release_id is null then
    select * into existing_release
    from public.release_announcements
    where release_key = theme_release_key;

    if existing_release.period_id <> active_period_id then
      raise exception 'Tema duyurusu eşzamanlı olarak başka bir dönem için kuyruğa alındı.' using errcode = 'P0001';
    end if;

    return jsonb_build_object(
      'release_key', theme_release_key,
      'release_announcement_id', existing_release.id,
      'recipient_count', existing_release.recipient_count,
      'already_queued', true
    );
  end if;

  insert into public.notifications (
    recipient_id, notification_type, channel, delivery_status, title, body,
    metadata, dedupe_key, scheduled_for
  )
  select
    recipient_id,
    'admin_announcement',
    'in_app',
    'queued',
    theme_title,
    theme_body,
    jsonb_build_object(
      'release_key', theme_release_key,
      'release_announcement_id', release_id,
      'url', theme_target_url
    ),
    format('release:%s:%s:in_app', theme_release_key, recipient_id),
    now()
  from unnest(recipient_ids) as recipients(recipient_id);

  insert into public.audit_logs (actor_id, entity_type, entity_id, action, after_data)
  values (
    auth.uid(),
    'admin_announcement',
    release_id,
    'created',
    jsonb_build_object(
      'release_key', theme_release_key,
      'recipient_count', recipient_count,
      'target_url', theme_target_url,
      'channel', 'push_via_in_app_queue'
    )
  );

  return jsonb_build_object(
    'release_key', theme_release_key,
    'release_announcement_id', release_id,
    'recipient_count', recipient_count,
    'already_queued', false
  );
end;
$$;

revoke all on function public.queue_theme_release_announcement(uuid) from public, anon, authenticated;
grant execute on function public.queue_theme_release_announcement(uuid) to service_role;

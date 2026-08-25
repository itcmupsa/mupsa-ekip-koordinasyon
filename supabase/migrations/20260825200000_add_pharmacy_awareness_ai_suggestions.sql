-- Eczacılık öğrencilerine uygun, kaynaklı önemli günler kataloğu ve
-- Halkla İlişkiler koordinatörüne yönelik AI içerik fırsatları.

create table public.awareness_date_catalog (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text not null check (category in (
    'pharmacy_profession', 'medication_safety', 'public_health', 'disease_awareness'
  )),
  month smallint not null check (month between 1 and 12),
  day smallint not null check (day between 1 and 31),
  end_month smallint check (end_month between 1 and 12),
  end_day smallint check (end_day between 1 and 31),
  pharmacy_relevance text not null check (char_length(trim(pharmacy_relevance)) between 20 and 600),
  source_name text not null,
  source_url text not null check (source_url ~ '^https://'),
  suggestion_lead_days integer not null default 90 check (suggestion_lead_days between 30 and 180),
  notification_lead_days integer not null default 60 check (notification_lead_days between 14 and suggestion_lead_days),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((end_month is null) = (end_day is null))
);

create table public.ai_awareness_suggestions (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.periods(id) on delete cascade,
  catalog_id uuid not null references public.awareness_date_catalog(id) on delete restrict,
  target_date date not null,
  target_end_date date,
  status text not null default 'new' check (status in ('new', 'seen', 'transferred', 'dismissed', 'expired')),
  payload jsonb not null,
  source_hash text not null check (char_length(source_hash) = 64),
  model_id text not null,
  notified_at timestamptz,
  acted_by uuid references public.profiles(id) on delete set null,
  acted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (period_id, catalog_id, target_date),
  check (target_end_date is null or target_end_date >= target_date)
);

create index ai_awareness_suggestions_period_status_date_idx
  on public.ai_awareness_suggestions(period_id, status, target_date);

drop trigger if exists awareness_date_catalog_set_updated_at on public.awareness_date_catalog;
create trigger awareness_date_catalog_set_updated_at
before update on public.awareness_date_catalog
for each row execute function public.set_updated_at();

drop trigger if exists ai_awareness_suggestions_set_updated_at on public.ai_awareness_suggestions;
create trigger ai_awareness_suggestions_set_updated_at
before update on public.ai_awareness_suggestions
for each row execute function public.set_updated_at();

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
      and (membership.app_role = 'super_admin' or role.slug = 'public-relations-coordinator')
  );
$$;

revoke all on function public.can_access_awareness_ai_suggestions(uuid) from public;
grant execute on function public.can_access_awareness_ai_suggestions(uuid) to authenticated;

create or replace function public.stamp_awareness_suggestion_action()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null and (
    new.period_id is distinct from old.period_id
    or new.catalog_id is distinct from old.catalog_id
    or new.target_date is distinct from old.target_date
    or new.target_end_date is distinct from old.target_end_date
    or new.payload is distinct from old.payload
    or new.source_hash is distinct from old.source_hash
    or new.model_id is distinct from old.model_id
    or new.notified_at is distinct from old.notified_at
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'Önerinin kaynak içeriği kullanıcı tarafından değiştirilemez.';
  end if;
  if new.status is distinct from old.status then
    if new.status not in ('seen', 'transferred', 'dismissed') then
      raise exception 'Bu öneri durumu kullanıcı tarafından seçilemez.';
    end if;
    new.acted_by := auth.uid();
    new.acted_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists ai_awareness_suggestions_stamp_action on public.ai_awareness_suggestions;
create trigger ai_awareness_suggestions_stamp_action
before update on public.ai_awareness_suggestions
for each row execute function public.stamp_awareness_suggestion_action();

alter table public.awareness_date_catalog enable row level security;
alter table public.ai_awareness_suggestions enable row level security;

create policy "active members read awareness date catalog"
on public.awareness_date_catalog for select
using (public.is_active_member());

create policy "authorized members read awareness ai suggestions"
on public.ai_awareness_suggestions for select
using (public.can_access_awareness_ai_suggestions(period_id));

create policy "authorized members update awareness ai suggestion status"
on public.ai_awareness_suggestions for update
using (public.can_access_awareness_ai_suggestions(period_id))
with check (public.can_access_awareness_ai_suggestions(period_id));

alter table public.notifications
  drop constraint if exists notifications_notification_type_check;

alter table public.notifications
  add constraint notifications_notification_type_check check (notification_type in (
    'task_assigned', 'task_updated', 'task_due_soon', 'task_overdue',
    'sks_status_changed', 'event_date_changed', 'event_member_added',
    'report_missing', 'link_missing', 'event_completed', 'dependency_activated',
    'dependency_review_required', 'admin_announcement', 'calendar_entry_reminder',
    'awareness_ai_suggestion'
  ));

insert into public.awareness_date_catalog (
  slug, name, category, month, day, end_month, end_day,
  pharmacy_relevance, source_name, source_url, suggestion_lead_days, notification_lead_days
) values
  (
    'world-patient-safety-day', 'Dünya Hasta Güvenliği Günü', 'medication_safety', 9, 17, null, null,
    'İlaç güvenliği, doğru ilaç kullanımı, hasta danışmanlığı ve eczacının güvenli bakım sürecindeki rolü açısından doğrudan ilgilidir.',
    'Dünya Sağlık Örgütü', 'https://www.who.int/campaigns/world-patient-safety-day', 90, 90
  ),
  (
    'world-pharmacists-day', 'Dünya Eczacılar Günü', 'pharmacy_profession', 9, 25, null, null,
    'Eczacılık mesleğini, eczacılık öğrencilerini ve eczacının sağlık sistemindeki rolünü doğrudan merkeze alan temel meslek günüdür.',
    'Uluslararası Eczacılık Federasyonu', 'https://www.fip.org/world-pharmacists-day', 120, 120
  ),
  (
    'world-mental-health-day', 'Dünya Ruh Sağlığı Günü', 'public_health', 10, 10, null, null,
    'Eczacılık öğrencileri için ruh sağlığı okuryazarlığı, ilaç tedavisinde danışmanlık ve damgalamayla mücadele başlıklarında uygun içerik fırsatıdır.',
    'Dünya Sağlık Örgütü', 'https://www.who.int/campaigns', 90, 90
  ),
  (
    'world-diabetes-day', 'Dünya Diyabet Günü', 'disease_awareness', 11, 14, null, null,
    'Diyabet ilaçlarının güvenli kullanımı, tedaviye uyum, doğru saklama ve eczacı danışmanlığı konularıyla ilişkilendirilebilir.',
    'Dünya Sağlık Örgütü', 'https://www.who.int/campaigns/world-diabetes-day', 90, 90
  ),
  (
    'world-amr-awareness-week', 'Dünya Antimikrobiyal Direnç Farkındalık Haftası', 'medication_safety', 11, 18, 11, 24,
    'Akılcı antibiyotik ve antimikrobiyal kullanımı, yanlış ilaç kullanımının önlenmesi ve eczacının halk sağlığı rolü açısından öncelikli bir konudur.',
    'Dünya Sağlık Örgütü', 'https://www.who.int/campaigns/world-amr-awareness-week', 120, 120
  ),
  (
    'world-aids-day', 'Dünya AIDS Günü', 'public_health', 12, 1, null, null,
    'İlaç tedavisine uyum, sağlık okuryazarlığı, mahremiyet ve damgalamadan uzak eczacılık hizmetleri açısından uygun içerik fırsatıdır.',
    'Dünya Sağlık Örgütü', 'https://www.who.int/campaigns', 90, 90
  ),
  (
    'world-health-day', 'Dünya Sağlık Günü', 'public_health', 4, 7, null, null,
    'Eczacının koruyucu sağlık hizmetleri, sağlık okuryazarlığı ve erişilebilir danışmanlıktaki rolünü anlatmak için kullanılabilir.',
    'Dünya Sağlık Örgütü', 'https://www.who.int/campaigns', 90, 90
  ),
  (
    'world-immunization-week', 'Dünya Bağışıklama Haftası', 'public_health', 4, 24, 4, 30,
    'Aşı okuryazarlığı, soğuk zincir, güvenilir sağlık bilgisi ve eczacıların bağışıklama hizmetlerindeki rolü açısından eczacılıkla ilişkilidir.',
    'Dünya Sağlık Örgütü', 'https://www.who.int/campaigns', 90, 90
  ),
  (
    'turkey-pharmacy-day', 'Bilimsel Eczacılık Günü', 'pharmacy_profession', 5, 14, null, null,
    'Türkiye’de eczacılık eğitimi, mesleğin gelişimi ve eczacılık öğrencilerinin gelecek rolü üzerine içerik üretmek için temel ulusal gündür.',
    'Türk Eczacıları Birliği', 'https://e-kutuphane.teb.org.tr/pdf/eczaciodasiyayinlari/ankaracilt12/3.pdf', 120, 120
  ),
  (
    'world-no-tobacco-day', 'Dünya Tütünsüz Günü', 'public_health', 5, 31, null, null,
    'Tütün bırakma danışmanlığı, ilaç tedavileri hakkında güvenli yönlendirme ve eczacının koruyucu sağlık rolü açısından uygundur.',
    'Dünya Sağlık Örgütü', 'https://www.who.int/campaigns', 90, 90
  )
on conflict (slug) do update set
  name = excluded.name,
  category = excluded.category,
  month = excluded.month,
  day = excluded.day,
  end_month = excluded.end_month,
  end_day = excluded.end_day,
  pharmacy_relevance = excluded.pharmacy_relevance,
  source_name = excluded.source_name,
  source_url = excluded.source_url,
  suggestion_lead_days = excluded.suggestion_lead_days,
  notification_lead_days = excluded.notification_lead_days,
  is_active = true;

-- Normal koordinatörün kişisel özetinde tekrar etmeyecek, görev ayrıntısı
-- içermeyen kısa kulüp özetini mevcut ortak Süper Yönetici özetinden türetir.
create or replace function public.get_my_safe_ai_club_digest(target_period_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  source_payload jsonb;
  safe_items jsonb;
  item_count integer;
begin
  if not exists (
    select 1 from public.period_memberships membership
    join public.profiles profile on profile.id = membership.profile_id and profile.is_active
    join public.periods period on period.id = membership.period_id and period.is_active
    where membership.profile_id = auth.uid()
      and membership.period_id = target_period_id
      and membership.is_active
  ) then
    raise exception 'Bu dönem için aktif üyelik bulunamadı.';
  end if;

  select output.payload
  into source_payload
  from public.ai_outputs output
  join public.period_memberships membership
    on membership.profile_id = output.recipient_id
   and membership.period_id = output.period_id
   and membership.is_active
   and membership.app_role = 'super_admin'
  where output.period_id = target_period_id
    and output.output_type = 'home_summary'
    and output.validation_status = 'valid'
  order by output.is_current desc, output.created_at desc
  limit 1;

  if source_payload is null then
    return null;
  end if;

  with personal_sources as (
    select 'event'::text as source_type, event_record.id::text as source_id
    from public.events event_record
    where event_record.period_id = target_period_id
      and event_record.deleted_at is null
      and (
        event_record.owner_id = auth.uid()
        or exists (select 1 from public.event_members member where member.event_id = event_record.id and member.profile_id = auth.uid())
        or exists (select 1 from public.event_process_members member where member.event_id = event_record.id and member.profile_id = auth.uid())
        or exists (
          select 1 from public.tasks task
          join public.task_assignees assignee on assignee.task_id = task.id and assignee.profile_id = auth.uid()
          where task.event_id = event_record.id and task.deleted_at is null
        )
      )
    union
    select 'awareness'::text, awareness.id::text
    from public.awareness_posts awareness
    where awareness.period_id = target_period_id
      and awareness.deleted_at is null
      and (
        awareness.created_by = auth.uid()
        or awareness.design_responsible_id = auth.uid()
        or awareness.press_publication_responsible_id = auth.uid()
        or exists (
          select 1 from public.tasks task
          join public.task_assignees assignee on assignee.task_id = task.id and assignee.profile_id = auth.uid()
          where task.awareness_post_id = awareness.id and task.deleted_at is null
        )
      )
  ), filtered as (
    select item
    from jsonb_array_elements(coalesce(source_payload -> 'items', '[]'::jsonb)) item
    where item ->> 'source_type' in ('event', 'awareness', 'calendar_entry')
      and not exists (
        select 1 from personal_sources personal
        where personal.source_type = item ->> 'source_type'
          and personal.source_id = item ->> 'source_id'
      )
    limit 2
  )
  select coalesce(jsonb_agg(item), '[]'::jsonb), count(*)
  into safe_items, item_count
  from filtered;

  return jsonb_build_object(
    'intro', case
      when item_count > 0 then format('Kulüpte ayrıca %s konu öne çıkıyor.', item_count)
      else 'Kulüpte bugün ayrıca öne çıkan bir gelişme bulunmuyor.'
    end,
    'items', safe_items
  );
end;
$$;

revoke all on function public.get_my_safe_ai_club_digest(uuid) from public;
grant execute on function public.get_my_safe_ai_club_digest(uuid) to authenticated;

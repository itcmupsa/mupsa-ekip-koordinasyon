-- Tasarım ile Duyuru/Yayın durumlarını ayrı alanlara ayır.
-- Mevcut design_announcement_status alanı Tasarım durumunu taşımaya devam eder;
-- yeni announcement_status alanı Duyuru/Yayın sürecini ayrı tutar.

create table public.event_announcement_statuses (
  slug text primary key,
  label text not null unique,
  sort_order smallint not null unique,
  is_active boolean not null default true
);

insert into public.event_announcement_statuses (slug, label, sort_order)
values
  ('not_required', 'Gerekli Değil', 10),
  ('content_pending', 'İçerik Bekliyor', 20),
  ('scheduled', 'Yayın Planlandı', 30),
  ('published', 'Yayınlandı', 40);

alter table public.events
  add column announcement_status text not null default 'not_required'
    references public.event_announcement_statuses(slug);

-- Mevcut kayıtları taşırken normal kullanıcı yetki/kilit/audit triggerları çalışmamalı.
-- Migration tek transaction içinde olduğundan bir hata olursa bu değişiklik de geri alınır.
alter table public.events disable trigger user;

update public.events
set announcement_status = case design_announcement_status
  when 'published' then 'published'
  when 'ready' then 'content_pending'
  when 'brief_pending' then 'content_pending'
  when 'in_design' then 'content_pending'
  when 'revision' then 'content_pending'
  else 'not_required'
end;

-- Eski birleşik akıştaki "Paylaşıldı" artık Duyuru/Yayın tarafına taşındığı için
-- Tasarım tarafında karşılığı "Hazır" olarak korunur.
update public.events
set design_announcement_status = 'ready'
where design_announcement_status = 'published';

alter table public.events enable trigger user;

create index events_announcement_status_idx on public.events(announcement_status);

alter table public.event_announcement_statuses enable row level security;
grant select on public.event_announcement_statuses to authenticated;

create policy "active members read event announcement statuses"
  on public.event_announcement_statuses for select
  using (public.is_active_member());

create policy "admins manage event announcement statuses"
  on public.event_announcement_statuses for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

create or replace function public.enforce_event_write_permissions()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  is_event_manager boolean;
  is_sks_owner boolean;
  is_design_owner boolean;
  is_press_owner boolean;
  allowed_fields text[] := array['updated_at'];
begin
  if public.is_super_admin() then
    return new;
  end if;

  is_event_manager := public.can_manage_event(old.id);
  is_sks_owner := exists (
    select 1 from public.event_process_members member
    where member.event_id = old.id and member.process_type = 'sks'
      and member.profile_id = auth.uid() and member.responsibility_type = 'owner'
  );
  is_design_owner := exists (
    select 1 from public.event_process_members member
    where member.event_id = old.id and member.process_type = 'design'
      and member.profile_id = auth.uid() and member.responsibility_type = 'owner'
  );
  is_press_owner := exists (
    select 1 from public.event_process_members member
    where member.event_id = old.id and member.process_type = 'press'
      and member.profile_id = auth.uid() and member.responsibility_type = 'owner'
  );

  if is_event_manager then
    allowed_fields := allowed_fields || array[
      'title', 'description', 'event_status', 'planning_date', 'estimated_date',
      'preparation_start_date', 'confirmed_date', 'venue', 'next_action',
      'general_note', 'report_status'
    ];
  end if;
  if is_sks_owner then allowed_fields := allowed_fields || array['sks_status']; end if;
  if is_design_owner then allowed_fields := allowed_fields || array['design_announcement_status']; end if;
  if is_press_owner then allowed_fields := allowed_fields || array['announcement_status']; end if;
  if public.can_access_event_budget() then
    allowed_fields := allowed_fields || array[
      'budget_status', 'estimated_budget', 'approved_budget', 'actual_expense', 'budget_note'
    ];
  end if;

  if not (is_event_manager or is_sks_owner or is_design_owner or is_press_owner or public.can_access_event_budget()) then
    raise exception 'Bu etkinliği düzenleme yetkiniz yok.';
  end if;
  if (to_jsonb(new) - allowed_fields) is distinct from (to_jsonb(old) - allowed_fields) then
    raise exception 'Kullanıcı rolünüz bu alanlardan bazılarını değiştirme yetkisine sahip değil.';
  end if;
  if is_event_manager
    and new.event_status in ('completed', 'reported', 'archived')
    and coalesce(new.sks_status, '') not in ('not_required', 'approved') then
    raise exception 'SKS onayı olmadan etkinlik tamamlanmış olarak işaretlenemez.';
  end if;
  return new;
end;
$$;

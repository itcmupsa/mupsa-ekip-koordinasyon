-- Faz 2: Etkinlik tasarım/duyuru ve rapor durumları.
-- Bu iki liste etkinlik kaydının genel süreç durumlarını tutar.

create table public.event_design_announcement_statuses (
  slug text primary key,
  label text not null unique,
  sort_order smallint not null unique,
  is_active boolean not null default true
);

create table public.event_report_statuses (
  slug text primary key,
  label text not null unique,
  sort_order smallint not null unique,
  is_active boolean not null default true
);

insert into public.event_design_announcement_statuses (slug, label, sort_order)
values
  ('not_required', 'Gerekli Değil', 10),
  ('brief_pending', 'Brief Bekliyor', 20),
  ('in_design', 'Tasarımda', 30),
  ('revision', 'Revize', 40),
  ('ready', 'Hazır', 50),
  ('published', 'Paylaşıldı', 60);

insert into public.event_report_statuses (slug, label, sort_order)
values
  ('no', 'Hayır', 10),
  ('preparing', 'Hazırlanıyor', 20),
  ('yes', 'Evet', 30);

alter table public.events
  add column design_announcement_status text not null default 'not_required'
    references public.event_design_announcement_statuses(slug),
  add column report_status text not null default 'no'
    references public.event_report_statuses(slug);

create index events_design_announcement_status_idx
  on public.events(design_announcement_status);

create index events_report_status_idx
  on public.events(report_status);

alter table public.event_design_announcement_statuses enable row level security;
alter table public.event_report_statuses enable row level security;

create policy "active members read event design announcement statuses"
  on public.event_design_announcement_statuses for select
  using (public.is_active_member());

create policy "admins manage event design announcement statuses"
  on public.event_design_announcement_statuses for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "active members read event report statuses"
  on public.event_report_statuses for select
  using (public.is_active_member());

create policy "admins manage event report statuses"
  on public.event_report_statuses for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Etkinlik sahibi yeni süreç alanlarını da genel etkinlik alanları gibi güncelleyebilir.
-- SKS ve bütçe sahiplerinin yetkileri genişletilmez.
create or replace function public.enforce_event_write_permissions()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  is_event_owner boolean;
  is_sks_owner boolean;
  is_budget_owner boolean;
  allowed_fields text[] := array['updated_at'];
begin
  if public.is_super_admin() then
    return new;
  end if;

  is_event_owner := old.owner_id = auth.uid();
  is_sks_owner := exists (
    select 1
    from public.event_process_members member
    where member.event_id = old.id
      and member.process_type = 'sks'
      and member.profile_id = auth.uid()
      and member.responsibility_type = 'owner'
  );
  is_budget_owner := exists (
    select 1
    from public.event_process_members member
    where member.event_id = old.id
      and member.process_type = 'budget'
      and member.profile_id = auth.uid()
      and member.responsibility_type = 'owner'
  );
  if is_event_owner then
    allowed_fields := allowed_fields || array[
      'title', 'description', 'event_status', 'planning_date',
      'estimated_date', 'preparation_start_date', 'confirmed_date',
      'venue', 'next_action', 'general_note',
      'design_announcement_status', 'report_status'
    ];
  else
    if not (is_sks_owner or is_budget_owner) then
      raise exception 'Bu etkinligi duzenleme yetkiniz yok.';
    end if;
    if is_sks_owner then
      allowed_fields := allowed_fields || array['sks_status'];
    end if;
    if is_budget_owner then
      allowed_fields := allowed_fields || array[
        'budget_status', 'estimated_budget', 'approved_budget',
        'actual_expense', 'budget_note'
      ];
    end if;
  end if;

  if (to_jsonb(new) - allowed_fields) is distinct from (to_jsonb(old) - allowed_fields) then
    raise exception 'Kullanıcı rolünüz bu alanlardan bazılarını değiştirme yetkisine sahip değil.';
  end if;

  if is_event_owner
    and new.event_status in ('completed', 'reported', 'archived')
    and coalesce(new.sks_status, '') not in ('not_required', 'approved') then
    raise exception 'SKS onayi olmadan etkinlik tamamlanmis olarak isaretlenemez.';
  end if;

  return new;
end;
$$;

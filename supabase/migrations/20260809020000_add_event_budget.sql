-- MUPSA Ekip Koordinasyon
-- Faz 2: Bütçe alanları ve bütçe süreci yetkileri

create table public.budget_statuses (
  slug text primary key,
  label text not null unique,
  sort_order smallint not null unique,
  is_active boolean not null default true
);

alter table public.budget_statuses enable row level security;

create policy "active members read budget statuses"
  on public.budget_statuses for select
  using (public.is_active_member());

create policy "admins manage budget statuses"
  on public.budget_statuses for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

insert into public.budget_statuses (slug, label, sort_order)
values
  ('not_required', 'Gerekli Değil', 10),
  ('preparing', 'Hazırlanıyor', 20),
  ('pending_approval', 'Onay Bekliyor', 30),
  ('approved', 'Onaylandı', 40),
  ('spending', 'Harcama Devam Ediyor', 50),
  ('completed', 'Tamamlandı', 60)
on conflict (slug) do nothing;

alter table public.events
  add column budget_status text references public.budget_statuses(slug),
  add column estimated_budget numeric(12, 2) check (estimated_budget >= 0),
  add column approved_budget numeric(12, 2) check (approved_budget >= 0),
  add column actual_expense numeric(12, 2) check (actual_expense >= 0),
  add column budget_note text;

-- Bütçe ve SKS süreç sahipleri yalnızca kendi süreç alanlarını güncelleyebilir.
-- Etkinlik sahibi bütçe/SKS alanlarını değiştiremez; genel etkinlik alanlarını yönetmeye devam eder.
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
      'venue', 'next_action', 'general_note'
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

drop policy if exists "authorized members update events" on public.events;

create policy "authorized members update events"
  on public.events for update
  using (
    public.is_active_member()
    and (
      public.can_manage_event(id)
      or exists (
        select 1
        from public.event_process_members member
        where member.event_id = id
          and member.process_type in ('sks', 'budget')
          and member.profile_id = auth.uid()
          and member.responsibility_type = 'owner'
      )
    )
  )
  with check (public.is_active_member());

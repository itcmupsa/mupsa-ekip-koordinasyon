-- Tasarım / Duyuru durumunun süreç sorumlusu tarafından yönetilmesi.
-- Önceki migration zaten uygulanmış olduğu için yetki düzeltmesi ayrı tutulur.

create or replace function public.enforce_event_write_permissions()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  is_event_owner boolean;
  is_sks_owner boolean;
  is_budget_owner boolean;
  is_design_owner boolean;
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
  is_design_owner := exists (
    select 1
    from public.event_process_members member
    where member.event_id = old.id
      and member.process_type in ('design', 'press')
      and member.profile_id = auth.uid()
      and member.responsibility_type = 'owner'
  );

  if is_event_owner then
    allowed_fields := allowed_fields || array[
      'title', 'description', 'event_status', 'planning_date',
      'estimated_date', 'preparation_start_date', 'confirmed_date',
      'venue', 'next_action', 'general_note', 'report_status'
    ];
  end if;
  if is_design_owner then
    allowed_fields := allowed_fields || array['design_announcement_status'];
  end if;

  if not (is_event_owner or is_design_owner) then
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
          and member.process_type in ('sks', 'budget', 'design', 'press')
          and member.profile_id = auth.uid()
          and member.responsibility_type = 'owner'
      )
    )
  )
  with check (public.is_active_member());

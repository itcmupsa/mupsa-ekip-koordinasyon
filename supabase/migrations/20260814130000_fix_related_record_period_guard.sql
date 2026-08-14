-- Merkezi görev migration'ı ortak dönem kilidi fonksiyonunu daha dar bir
-- sürümle değiştirmişti. Etkinlik kalıcı silinirken cascade ile temizlenen
-- karar, rapor, bağlantı, dosya ve sponsor kayıtlarını tekrar destekle.
create or replace function public.assert_related_event_period_unlocked()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  target_event_id uuid;
  target_task_id uuid;
  target_period_id uuid;
begin
  if tg_table_name in (
    'event_members',
    'event_process_members',
    'event_decisions',
    'event_reports',
    'event_budget_sponsors'
  ) then
    target_event_id := case when tg_op = 'DELETE' then old.event_id else new.event_id end;
    select event_record.period_id into target_period_id
    from public.events event_record
    where event_record.id = target_event_id;
  elsif tg_table_name in ('task_assignees', 'task_dependencies') then
    target_task_id := case when tg_op = 'DELETE' then old.task_id else new.task_id end;
    select task_record.period_id into target_period_id
    from public.tasks task_record
    where task_record.id = target_task_id;
  elsif tg_table_name in ('event_links', 'event_files') then
    target_event_id := case when tg_op = 'DELETE' then old.event_id else new.event_id end;
    target_task_id := case when tg_op = 'DELETE' then old.task_id else new.task_id end;

    if target_event_id is not null then
      select event_record.period_id into target_period_id
      from public.events event_record
      where event_record.id = target_event_id;
    else
      select task_record.period_id into target_period_id
      from public.tasks task_record
      where task_record.id = target_task_id;
    end if;
  else
    raise exception 'Desteklenmeyen tablo: %', tg_table_name;
  end if;

  if not public.is_super_admin() and public.is_period_locked(target_period_id) then
    raise exception 'Bu dönem kilitli olduğu için ilgili kayıt değiştirilemez.';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

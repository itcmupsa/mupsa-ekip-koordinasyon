-- Faz 1 / Bildirim motoru - Parca 3
-- SKS onayi veya bagli bir gorevin tamamlanmasi sonucu, tum kosullari saglanan
-- taslak gorevleri aktif eder ve sadece o gorevin atananlarina bildirim uretir.
-- Tarih bazli bagimliliklar pg_cron taramasinda ayri olarak ele alinacaktir.

create or replace function public.enforce_task_write_permissions()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Yalnizca SECURITY DEFINER otomasyonlari ve Supabase'in guvenli SQL yonetim
  -- baglantisi bu daldan gecerek bagimli gorevin aktivasyonunu yapabilir.
  if current_user = 'postgres' then
    return new;
  end if;

  if public.is_super_admin() then
    return new;
  end if;

  if public.can_manage_task(old.id) then
    if new.event_id is distinct from old.event_id
      or new.created_by is distinct from old.created_by
      or new.deleted_at is distinct from old.deleted_at
      or new.deleted_by is distinct from old.deleted_by
      or new.deletion_note is distinct from old.deletion_note then
      raise exception 'Bu gorev alani yalnizca Super Yonetici tarafindan degistirilebilir.';
    end if;
    return new;
  end if;

  if public.is_task_assignee(old.id) then
    if (to_jsonb(new) - array['progress_status', 'notes', 'updated_at'])
       is distinct from
       (to_jsonb(old) - array['progress_status', 'notes', 'updated_at']) then
      raise exception 'Gorev sorumlusu yalnizca ilerleme durumu ve not alanini degistirebilir.';
    end if;
    return new;
  end if;

  raise exception 'Bu gorevi duzenleme yetkiniz yok.';
end;
$$;

create or replace function public.activate_ready_dependent_tasks(
  changed_event_id uuid default null,
  changed_task_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  with activated_tasks as (
    update public.tasks dependent_task
    set activation_status = 'active'
    where dependent_task.activation_status = 'draft'
      and dependent_task.deleted_at is null
      and exists (
        select 1
        from public.task_dependencies changed_dependency
        where changed_dependency.task_id = dependent_task.id
          and (
            (changed_event_id is not null and changed_dependency.source_event_id = changed_event_id)
            or (changed_task_id is not null and changed_dependency.source_task_id = changed_task_id)
          )
      )
      and not exists (
        select 1
        from public.task_dependencies required_dependency
        where required_dependency.task_id = dependent_task.id
          and not (
            (required_dependency.dependency_type = 'sks_status' and exists (
              select 1
              from public.events source_event
              where source_event.id = required_dependency.source_event_id
                and source_event.sks_status = required_dependency.required_sks_status
            ))
            or
            (required_dependency.dependency_type = 'task_progress' and exists (
              select 1
              from public.tasks source_task
              where source_task.id = required_dependency.source_task_id
                and source_task.progress_status = required_dependency.required_task_progress_status
                and source_task.deleted_at is null
            ))
            -- Tarih bazli kosullar bu anlik tetikleyicide saglanmis
            -- sayilmaz; pg_cron taramasi bunlari ayri degerlendirecektir.
          )
      )
    returning dependent_task.id, dependent_task.event_id, dependent_task.title, dependent_task.updated_at
  )
  insert into public.notifications (
    recipient_id,
    event_id,
    task_id,
    notification_type,
    channel,
    title,
    body,
    metadata,
    dedupe_key
  )
  select
    assignee.profile_id,
    activated_task.event_id,
    activated_task.id,
    'dependency_activated',
    notification_channel.channel,
    'Bağımlı göreviniz aktifleşti',
    format(
      '“%s” etkinliğindeki “%s” görevi artık aktif; sıra sizde.',
      event_record.title,
      activated_task.title
    ),
    jsonb_build_object(
      'activation_reason', 'dependency_satisfied',
      'activated_at', activated_task.updated_at
    ),
    format(
      'dependency-activated:%s:%s:%s:%s',
      activated_task.id,
      activated_task.updated_at,
      assignee.profile_id,
      notification_channel.channel
    )
  from activated_tasks activated_task
  join public.events event_record on event_record.id = activated_task.event_id
  join public.task_assignees assignee on assignee.task_id = activated_task.id
  cross join (values ('in_app'), ('email')) as notification_channel(channel);
end;
$$;

create or replace function public.activate_dependencies_after_sks_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.sks_status <> 'rejected' and new.deleted_at is null then
    perform public.activate_ready_dependent_tasks(new.id, null);
  end if;
  return new;
end;
$$;

create or replace function public.activate_dependencies_after_task_progress_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.progress_status <> 'cancelled' and new.deleted_at is null then
    perform public.activate_ready_dependent_tasks(null, new.id);
  end if;
  return new;
end;
$$;

create trigger activate_dependencies_on_sks_status_change
after update of sks_status on public.events
for each row
when (old.sks_status is distinct from new.sks_status)
execute function public.activate_dependencies_after_sks_status_change();

create trigger activate_dependencies_on_task_progress_change
after update of progress_status on public.tasks
for each row
when (old.progress_status is distinct from new.progress_status)
execute function public.activate_dependencies_after_task_progress_change();

revoke all on function public.activate_ready_dependent_tasks(uuid, uuid) from public;

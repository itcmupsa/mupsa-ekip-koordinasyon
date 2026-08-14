-- Etkinlik veya farkındalık pasifleştirildiğinde bağlı, pasifleştirilebilir
-- kayıtları da pasifleştir. Ana kayıt yeniden açılırsa yalnızca bu zincir
-- tarafından pasifleştirilen kayıtları geri aç.

create table public.cascade_deactivations (
  parent_type text not null check (parent_type in ('event', 'awareness_post')),
  parent_id uuid not null,
  child_table text not null check (child_table in (
    'tasks', 'event_decisions', 'event_reports', 'event_links', 'event_files',
    'event_budget_sponsors'
  )),
  child_id uuid not null,
  child_deleted_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (parent_type, parent_id, child_table, child_id)
);

alter table public.cascade_deactivations enable row level security;
revoke all on table public.cascade_deactivations from anon, authenticated;

create or replace function public.cascade_parent_deactivation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_parent_type text := case
    when tg_table_name = 'events' then 'event'
    else 'awareness_post'
  end;
  automatic_note text := case
    when tg_table_name = 'events' then 'Bağlı etkinlik pasifleştirildiği için otomatik pasifleştirildi.'
    else 'Bağlı farkındalık pasifleştirildiği için otomatik pasifleştirildi.'
  end;
begin
  if tg_op = 'DELETE' then
    delete from public.cascade_deactivations
    where parent_type = target_parent_type
      and parent_id = old.id;
    return old;
  end if;

  if old.deleted_at is null and new.deleted_at is not null then
    if tg_table_name = 'events' then
      insert into public.cascade_deactivations (
        parent_type, parent_id, child_table, child_id, child_deleted_at
      )
      select target_parent_type, new.id, 'tasks', task.id, new.deleted_at
      from public.tasks task
      where task.event_id = new.id
        and task.deleted_at is null
      on conflict (parent_type, parent_id, child_table, child_id)
      do update set child_deleted_at = excluded.child_deleted_at, created_at = now();

      insert into public.cascade_deactivations (
        parent_type, parent_id, child_table, child_id, child_deleted_at
      )
      select target_parent_type, new.id, 'event_decisions', decision.id, new.deleted_at
      from public.event_decisions decision
      where decision.event_id = new.id
        and decision.deleted_at is null
      on conflict (parent_type, parent_id, child_table, child_id)
      do update set child_deleted_at = excluded.child_deleted_at, created_at = now();

      insert into public.cascade_deactivations (
        parent_type, parent_id, child_table, child_id, child_deleted_at
      )
      select target_parent_type, new.id, 'event_reports', report.id, new.deleted_at
      from public.event_reports report
      where report.event_id = new.id
        and report.deleted_at is null
      on conflict (parent_type, parent_id, child_table, child_id)
      do update set child_deleted_at = excluded.child_deleted_at, created_at = now();

      insert into public.cascade_deactivations (
        parent_type, parent_id, child_table, child_id, child_deleted_at
      )
      select target_parent_type, new.id, 'event_budget_sponsors', sponsor.id, new.deleted_at
      from public.event_budget_sponsors sponsor
      where sponsor.event_id = new.id
        and sponsor.deleted_at is null
      on conflict (parent_type, parent_id, child_table, child_id)
      do update set child_deleted_at = excluded.child_deleted_at, created_at = now();
    else
      insert into public.cascade_deactivations (
        parent_type, parent_id, child_table, child_id, child_deleted_at
      )
      select target_parent_type, new.id, 'tasks', task.id, new.deleted_at
      from public.tasks task
      where task.awareness_post_id = new.id
        and task.deleted_at is null
      on conflict (parent_type, parent_id, child_table, child_id)
      do update set child_deleted_at = excluded.child_deleted_at, created_at = now();
    end if;

    insert into public.cascade_deactivations (
      parent_type, parent_id, child_table, child_id, child_deleted_at
    )
    select target_parent_type, new.id, 'event_links', link.id, new.deleted_at
    from public.event_links link
    where link.deleted_at is null
      and (
        (tg_table_name = 'events' and link.event_id = new.id)
        or link.task_id in (
          select task.id
          from public.tasks task
          where (tg_table_name = 'events' and task.event_id = new.id)
             or (tg_table_name = 'awareness_posts' and task.awareness_post_id = new.id)
        )
      )
    on conflict (parent_type, parent_id, child_table, child_id)
    do update set child_deleted_at = excluded.child_deleted_at, created_at = now();

    insert into public.cascade_deactivations (
      parent_type, parent_id, child_table, child_id, child_deleted_at
    )
    select target_parent_type, new.id, 'event_files', file_record.id, new.deleted_at
    from public.event_files file_record
    where file_record.deleted_at is null
      and (
        (tg_table_name = 'events' and file_record.event_id = new.id)
        or file_record.task_id in (
          select task.id
          from public.tasks task
          where (tg_table_name = 'events' and task.event_id = new.id)
             or (tg_table_name = 'awareness_posts' and task.awareness_post_id = new.id)
        )
      )
    on conflict (parent_type, parent_id, child_table, child_id)
    do update set child_deleted_at = excluded.child_deleted_at, created_at = now();

    update public.tasks task
    set deleted_at = new.deleted_at,
        deleted_by = new.deleted_by,
        deletion_note = automatic_note
    where task.deleted_at is null
      and ((tg_table_name = 'events' and task.event_id = new.id)
        or (tg_table_name = 'awareness_posts' and task.awareness_post_id = new.id));

    if tg_table_name = 'events' then
      update public.event_decisions
      set deleted_at = new.deleted_at, deleted_by = new.deleted_by, deletion_note = automatic_note
      where event_id = new.id and deleted_at is null;

      update public.event_reports
      set deleted_at = new.deleted_at, deleted_by = new.deleted_by, deletion_note = automatic_note
      where event_id = new.id and deleted_at is null;

      update public.event_budget_sponsors
      set deleted_at = new.deleted_at, deleted_by = new.deleted_by, deletion_note = automatic_note
      where event_id = new.id and deleted_at is null;
    end if;

    update public.event_links link
    set deleted_at = new.deleted_at, deleted_by = new.deleted_by, deletion_note = automatic_note
    from public.cascade_deactivations cascade_record
    where cascade_record.parent_type = target_parent_type
      and cascade_record.parent_id = new.id
      and cascade_record.child_table = 'event_links'
      and cascade_record.child_id = link.id
      and link.deleted_at is null;

    update public.event_files file_record
    set deleted_at = new.deleted_at, deleted_by = new.deleted_by, deletion_note = automatic_note
    from public.cascade_deactivations cascade_record
    where cascade_record.parent_type = target_parent_type
      and cascade_record.parent_id = new.id
      and cascade_record.child_table = 'event_files'
      and cascade_record.child_id = file_record.id
      and file_record.deleted_at is null;

  elsif old.deleted_at is not null and new.deleted_at is null then
    update public.tasks task
    set deleted_at = null, deleted_by = null, deletion_note = null
    from public.cascade_deactivations cascade_record
    where cascade_record.parent_type = target_parent_type
      and cascade_record.parent_id = new.id
      and cascade_record.child_table = 'tasks'
      and cascade_record.child_id = task.id
      and task.deleted_at = cascade_record.child_deleted_at;

    update public.event_decisions decision
    set deleted_at = null, deleted_by = null, deletion_note = null
    from public.cascade_deactivations cascade_record
    where cascade_record.parent_type = target_parent_type
      and cascade_record.parent_id = new.id
      and cascade_record.child_table = 'event_decisions'
      and cascade_record.child_id = decision.id
      and decision.deleted_at = cascade_record.child_deleted_at;

    update public.event_reports report
    set deleted_at = null, deleted_by = null, deletion_note = null
    from public.cascade_deactivations cascade_record
    where cascade_record.parent_type = target_parent_type
      and cascade_record.parent_id = new.id
      and cascade_record.child_table = 'event_reports'
      and cascade_record.child_id = report.id
      and report.deleted_at = cascade_record.child_deleted_at;

    update public.event_budget_sponsors sponsor
    set deleted_at = null, deleted_by = null, deletion_note = null
    from public.cascade_deactivations cascade_record
    where cascade_record.parent_type = target_parent_type
      and cascade_record.parent_id = new.id
      and cascade_record.child_table = 'event_budget_sponsors'
      and cascade_record.child_id = sponsor.id
      and sponsor.deleted_at = cascade_record.child_deleted_at;

    update public.event_links link
    set deleted_at = null, deleted_by = null, deletion_note = null
    from public.cascade_deactivations cascade_record
    where cascade_record.parent_type = target_parent_type
      and cascade_record.parent_id = new.id
      and cascade_record.child_table = 'event_links'
      and cascade_record.child_id = link.id
      and link.deleted_at = cascade_record.child_deleted_at;

    update public.event_files file_record
    set deleted_at = null, deleted_by = null, deletion_note = null
    from public.cascade_deactivations cascade_record
    where cascade_record.parent_type = target_parent_type
      and cascade_record.parent_id = new.id
      and cascade_record.child_table = 'event_files'
      and cascade_record.child_id = file_record.id
      and file_record.deleted_at = cascade_record.child_deleted_at;

    delete from public.cascade_deactivations
    where parent_type = target_parent_type
      and parent_id = new.id;
  end if;

  return new;
end;
$$;

revoke all on function public.cascade_parent_deactivation() from public;

drop trigger if exists events_cascade_deactivation on public.events;
create trigger events_cascade_deactivation
after update of deleted_at or delete on public.events
for each row execute function public.cascade_parent_deactivation();

drop trigger if exists awareness_posts_cascade_deactivation on public.awareness_posts;
create trigger awareness_posts_cascade_deactivation
after update of deleted_at or delete on public.awareness_posts
for each row execute function public.cascade_parent_deactivation();

-- Merkezi görev ekranı için görevleri etkinlikten bağımsızlaştırır.
-- Görev bir etkinliğe, bir farkındalığa veya yalnızca aktif döneme bağlanabilir.

alter table public.tasks
  add column period_id uuid,
  add column awareness_post_id uuid references public.awareness_posts(id) on delete restrict;

update public.tasks task
set period_id = event_record.period_id
from public.events event_record
where event_record.id = task.event_id
  and task.period_id is null;

alter table public.tasks
  add constraint tasks_period_id_fkey foreign key (period_id) references public.periods(id) on delete restrict;

alter table public.tasks
  alter column event_id drop not null,
  alter column period_id set not null;

alter table public.tasks
  add constraint tasks_context_check check (num_nonnulls(event_id, awareness_post_id) <= 1),
  add constraint tasks_context_process_check check (event_id is not null or process_type is null);

create index tasks_period_id_idx on public.tasks(period_id, deadline_at) where deleted_at is null;
create index tasks_awareness_post_id_idx on public.tasks(awareness_post_id) where deleted_at is null;

create or replace function public.validate_task_context()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  related_period_id uuid;
begin
  if new.event_id is not null then
    select period_id into related_period_id
    from public.events
    where id = new.event_id;
    if related_period_id is null then
      raise exception 'Görevin bağlı olduğu etkinlik bulunamadı.';
    end if;
  elsif new.awareness_post_id is not null then
    select period_id into related_period_id
    from public.awareness_posts
    where id = new.awareness_post_id;
    if related_period_id is null then
      raise exception 'Görevin bağlı olduğu farkındalık bulunamadı.';
    end if;
  end if;

  if related_period_id is not null and related_period_id is distinct from new.period_id then
    raise exception 'Görev ile bağlı kaydın dönemi aynı olmalıdır.';
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_validate_context on public.tasks;
create trigger tasks_validate_context
before insert or update of period_id, event_id, awareness_post_id on public.tasks
for each row execute function public.validate_task_context();

create or replace function public.assert_task_period_unlocked()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not public.is_super_admin() and public.is_period_locked(new.period_id) then
    raise exception 'Bu dönem kilitli olduğu için görev değiştirilemez.';
  end if;
  return new;
end;
$$;

create or replace function public.assert_related_event_period_unlocked()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  target_period_id uuid;
  target_task_id uuid;
  target_event_id uuid;
begin
  if tg_table_name in ('event_members', 'event_process_members') then
    target_event_id := case when tg_op = 'DELETE' then old.event_id else new.event_id end;
    select period_id into target_period_id from public.events where id = target_event_id;
  elsif tg_table_name in ('task_assignees', 'task_dependencies') then
    target_task_id := case when tg_op = 'DELETE' then old.task_id else new.task_id end;
    select period_id into target_period_id from public.tasks where id = target_task_id;
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

create or replace function public.can_manage_task(target_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or exists (
      select 1
      from public.tasks task
      join public.events event_record on event_record.id = task.event_id
      where task.id = target_task_id
        and (event_record.owner_id = auth.uid() or public.can_manage_event_process(event_record.id, task.process_type))
    )
    or exists (
      select 1
      from public.tasks task
      where task.id = target_task_id
        and task.awareness_post_id is not null
        and public.can_manage_awareness(task.awareness_post_id)
    );
$$;

create or replace function public.can_create_task(
  target_period_id uuid,
  target_event_id uuid,
  target_awareness_post_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_active_member()
    and exists (
      select 1 from public.period_memberships membership
      where membership.period_id = target_period_id
        and membership.profile_id = auth.uid()
        and membership.is_active
    )
    and (
      public.is_super_admin()
      or (target_event_id is not null and public.can_manage_event(target_event_id))
      or (target_awareness_post_id is not null and public.can_manage_awareness(target_awareness_post_id))
    );
$$;

drop policy if exists "event and process managers create tasks" on public.tasks;
create policy "authorized members create tasks" on public.tasks for insert with check (
  created_by = auth.uid()
  and not public.is_period_locked(period_id)
  and public.can_create_task(period_id, event_id, awareness_post_id)
);

create or replace function public.validate_task_assignee_period()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  target_period_id uuid;
begin
  select period_id into target_period_id from public.tasks where id = new.task_id;
  if target_period_id is null or not exists (
    select 1 from public.period_memberships membership
    join public.profiles profile on profile.id = membership.profile_id
    where membership.period_id = target_period_id
      and membership.profile_id = new.profile_id
      and membership.is_active
      and profile.is_active
  ) then
    raise exception 'Görev yalnızca aktif dönem üyelerine atanabilir.';
  end if;
  return new;
end;
$$;

drop trigger if exists task_assignees_validate_period on public.task_assignees;
create trigger task_assignees_validate_period
before insert or update on public.task_assignees
for each row execute function public.validate_task_assignee_period();

create or replace function public.enforce_task_write_permissions()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.is_super_admin() then return new; end if;

  if public.can_manage_task(old.id) then
    if new.period_id is distinct from old.period_id
      or new.event_id is distinct from old.event_id
      or new.awareness_post_id is distinct from old.awareness_post_id
      or new.process_type is distinct from old.process_type
      or new.created_by is distinct from old.created_by
      or new.deleted_at is distinct from old.deleted_at
      or new.deleted_by is distinct from old.deleted_by
      or new.deletion_note is distinct from old.deletion_note then
      raise exception 'Görevin bağlı olduğu kayıt ve yönetim alanları değiştirilemez.';
    end if;
    return new;
  end if;

  if public.is_task_assignee(old.id) then
    if (to_jsonb(new) - array['progress_status', 'notes', 'updated_at'])
       is distinct from (to_jsonb(old) - array['progress_status', 'notes', 'updated_at']) then
      raise exception 'Görev sorumlusu yalnızca ilerleme durumu ve not alanını değiştirebilir.';
    end if;
    return new;
  end if;

  raise exception 'Bu görevi düzenleme yetkiniz yok.';
end;
$$;

create or replace function public.assert_task_dependency_context()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  task_event_id uuid;
  source_task_event_id uuid;
begin
  select event_id into task_event_id from public.tasks where id = new.task_id;
  if task_event_id is null then
    raise exception 'Bağımlılık yalnızca etkinliğe bağlı görevlerde kullanılabilir.';
  end if;

  if new.dependency_type in ('sks_status', 'event_date_offset')
    and new.source_event_id is distinct from task_event_id then
    raise exception 'Etkinlik tabanlı bağımlılık aynı etkinliğe bağlı olmalıdır.';
  end if;

  if new.dependency_type = 'task_progress' then
    select event_id into source_task_event_id from public.tasks where id = new.source_task_id;
    if source_task_event_id is distinct from task_event_id then
      raise exception 'Görev bağımlılığı aynı etkinliğe bağlı görevler arasında olmalıdır.';
    end if;
  end if;
  return new;
end;
$$;

-- Merkezi sayfadan oluşturulan görev atamalarında etkinlik bağımlılığı zorunlu değildir.
create or replace function public.queue_task_assigned_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_event_id uuid;
  current_context_title text;
  current_task_title text;
  assignment_label text;
begin
  select task.event_id,
         coalesce(event_record.title, awareness.awareness_name, 'Bağımsız görev'),
         task.title
    into current_event_id, current_context_title, current_task_title
  from public.tasks task
  left join public.events event_record on event_record.id = task.event_id
  left join public.awareness_posts awareness on awareness.id = task.awareness_post_id
  where task.id = new.task_id;

  if not found then raise exception 'Bildirim için görev bulunamadı.'; end if;

  assignment_label := case new.assignment_type
    when 'primary' then 'ana sorumlu'
    when 'supporting' then 'destekleyen kişi'
    when 'informed' then 'bilgilendirilecek kişi'
  end;

  insert into public.notifications (
    recipient_id, event_id, task_id, notification_type, channel, title, body, metadata, dedupe_key
  )
  select
    new.profile_id,
    current_event_id,
    new.task_id,
    'task_assigned',
    notification_channel.channel,
    'Yeni görev ataması',
    format('“%s” bağlamındaki “%s” görevi için %s olarak atandınız.', current_context_title, current_task_title, assignment_label),
    jsonb_build_object('assignment_id', new.id, 'assignment_type', new.assignment_type, 'assigned_by', new.assigned_by),
    format('task-assigned:%s:%s', new.id, notification_channel.channel)
  from (values ('in_app'), ('email')) as notification_channel(channel)
  on conflict do nothing;
  return new;
end;
$$;

create or replace function public.get_my_calendar_task_deadlines(target_period_id uuid)
returns table (
  id uuid,
  event_id uuid,
  event_title text,
  title text,
  deadline_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    task.id,
    task.event_id,
    coalesce(event_record.title, awareness.awareness_name, 'Bağımsız görev'),
    task.title,
    task.deadline_at
  from public.tasks task
  left join public.events event_record on event_record.id = task.event_id
  left join public.awareness_posts awareness on awareness.id = task.awareness_post_id
  join public.task_assignees assignee on assignee.task_id = task.id
  where assignee.profile_id = auth.uid()
    and assignee.assignment_type in ('primary', 'supporting')
    and task.period_id = target_period_id
    and (event_record.id is null or event_record.deleted_at is null)
    and (awareness.id is null or awareness.deleted_at is null)
    and task.activation_status = 'active'
    and task.progress_status not in ('completed', 'cancelled')
    and task.deleted_at is null
    and task.deadline_at is not null
    and exists (
      select 1 from public.period_memberships membership
      where membership.period_id = target_period_id
        and membership.profile_id = auth.uid()
        and membership.is_active
    )
  order by task.deadline_at asc;
$$;


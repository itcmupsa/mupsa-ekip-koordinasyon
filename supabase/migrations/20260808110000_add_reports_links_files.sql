-- MUPSA Ekip Koordinasyon
-- Faz 2 / Adım 1: Etkinlik raporları, bağlantılar ve dosya metadata altyapısı

create table public.event_reports (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0),
  report_text text not null check (char_length(trim(report_text)) > 0),
  report_date date not null default current_date,
  created_by uuid not null references public.profiles(id) on delete restrict,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete set null,
  deletion_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (deleted_at is null or deleted_by is not null)
);

create table public.event_links (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0),
  url text not null check (char_length(trim(url)) > 0),
  description text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete set null,
  deletion_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((event_id is not null and task_id is null) or (event_id is null and task_id is not null)),
  check (deleted_at is null or deleted_by is not null)
);

create table public.event_files (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  storage_path text not null unique check (char_length(trim(storage_path)) > 0),
  original_file_name text not null check (char_length(trim(original_file_name)) > 0),
  mime_type text not null check (char_length(trim(mime_type)) > 0),
  file_size_bytes bigint not null check (file_size_bytes > 0 and file_size_bytes <= 5242880),
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete set null,
  deletion_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((event_id is not null and task_id is null) or (event_id is null and task_id is not null)),
  check (deleted_at is null or deleted_by is not null)
);

create index event_reports_event_id_idx
  on public.event_reports(event_id, created_at desc);
create index event_links_event_id_idx
  on public.event_links(event_id, created_at desc)
  where event_id is not null;
create index event_links_task_id_idx
  on public.event_links(task_id, created_at desc)
  where task_id is not null;
create index event_files_event_id_idx
  on public.event_files(event_id, created_at desc)
  where event_id is not null;
create index event_files_task_id_idx
  on public.event_files(task_id, created_at desc)
  where task_id is not null;

create or replace function public.assert_related_event_period_unlocked()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  target_event_id uuid;
  target_period_id uuid;
begin
  if tg_table_name in ('event_members', 'event_process_members', 'event_decisions', 'event_reports') then
    target_event_id := case when tg_op = 'DELETE' then old.event_id else new.event_id end;
  elsif tg_table_name in ('task_assignees', 'task_dependencies') then
    select t.event_id into target_event_id
    from public.tasks t
    where t.id = case when tg_op = 'DELETE' then old.task_id else new.task_id end;
  elsif tg_table_name in ('event_links', 'event_files') then
    if (case when tg_op = 'DELETE' then old.event_id else new.event_id end) is not null then
      target_event_id := case when tg_op = 'DELETE' then old.event_id else new.event_id end;
    else
      select t.event_id into target_event_id
      from public.tasks t
      where t.id = case when tg_op = 'DELETE' then old.task_id else new.task_id end;
    end if;
  else
    raise exception 'Desteklenmeyen tablo: %', tg_table_name;
  end if;

  select e.period_id into target_period_id
  from public.events e
  where e.id = target_event_id;

  if not public.is_super_admin() and public.is_period_locked(target_period_id) then
    raise exception 'Bu dönem kilitli olduğu için ilgili kayıt değiştirilemez.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

alter table public.audit_logs
  drop constraint if exists audit_logs_entity_type_check;

alter table public.audit_logs
  add constraint audit_logs_entity_type_check check (
    entity_type in (
      'event', 'task', 'event_process_member', 'task_assignee', 'task_dependency',
      'period_membership', 'event_decision', 'event_report', 'event_link', 'event_file'
    )
  );

create trigger event_reports_set_updated_at
before update on public.event_reports
for each row execute function public.set_updated_at();

create trigger event_links_set_updated_at
before update on public.event_links
for each row execute function public.set_updated_at();

create trigger event_files_set_updated_at
before update on public.event_files
for each row execute function public.set_updated_at();

create trigger event_reports_assert_period_unlocked
before insert or update or delete on public.event_reports
for each row execute function public.assert_related_event_period_unlocked();

create trigger event_links_assert_period_unlocked
before insert or update or delete on public.event_links
for each row execute function public.assert_related_event_period_unlocked();

create trigger event_files_assert_period_unlocked
before insert or update or delete on public.event_files
for each row execute function public.assert_related_event_period_unlocked();

create trigger audit_event_reports
after insert or update or delete on public.event_reports
for each row execute function public.record_audit_log('event_report');

create trigger audit_event_links
after insert or update or delete on public.event_links
for each row execute function public.record_audit_log('event_link');

create trigger audit_event_files
after insert or update or delete on public.event_files
for each row execute function public.record_audit_log('event_file');

alter table public.event_reports enable row level security;
alter table public.event_links enable row level security;
alter table public.event_files enable row level security;

create policy "active members read event reports"
on public.event_reports for select
using (public.is_active_member());

create policy "active members read event links"
on public.event_links for select
using (public.is_active_member());

create policy "active members read event files"
on public.event_files for select
using (public.is_active_member());

create policy "event managers create reports"
on public.event_reports for insert
with check (
  public.is_active_member()
  and public.can_manage_event(event_id)
  and created_by = auth.uid()
);

create policy "active event managers update reports"
on public.event_reports for update
using (public.is_active_member() and public.can_manage_event(event_id))
with check (public.is_active_member() and public.can_manage_event(event_id));

create policy "admins permanently delete reports"
on public.event_reports for delete
using (public.is_super_admin());

create policy "authorized members create links"
on public.event_links for insert
with check (
  public.is_active_member()
  and created_by = auth.uid()
  and (
    (event_id is not null and public.can_manage_event(event_id))
    or (task_id is not null and public.can_manage_task(task_id))
  )
);

create policy "active authorized members update links"
on public.event_links for update
using (
  public.is_active_member()
  and (
    (event_id is not null and public.can_manage_event(event_id))
    or (task_id is not null and public.can_manage_task(task_id))
  )
)
with check (
  public.is_active_member()
  and (
    (event_id is not null and public.can_manage_event(event_id))
    or (task_id is not null and public.can_manage_task(task_id))
  )
);

create policy "admins permanently delete links"
on public.event_links for delete
using (public.is_super_admin());

create policy "authorized members upload files"
on public.event_files for insert
with check (
  public.is_active_member()
  and uploaded_by = auth.uid()
  and (
    (event_id is not null and public.can_manage_event(event_id))
    or (task_id is not null and public.can_manage_task(task_id))
  )
);

create policy "active authorized members update file metadata"
on public.event_files for update
using (
  public.is_active_member()
  and (
    (event_id is not null and public.can_manage_event(event_id))
    or (task_id is not null and public.can_manage_task(task_id))
  )
)
with check (
  public.is_active_member()
  and (
    (event_id is not null and public.can_manage_event(event_id))
    or (task_id is not null and public.can_manage_task(task_id))
  )
);

create policy "admins permanently delete files"
on public.event_files for delete
using (public.is_super_admin());

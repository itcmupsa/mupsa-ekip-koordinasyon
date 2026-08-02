-- MUPSA Ekip Koordinasyon Uygulamasi
-- Faz 1 / Adim 1: Supabase veritabani iskeleti
-- Bu migration kullanici, etkinlik veya test verisi eklemez.

create extension if not exists pgcrypto;

-- Degistirilebilir durum ve rol listeleri. IT bunlari ileride ayarlar ekranindan yonetebilir.
create table public.event_statuses (
  slug text primary key,
  label text not null unique,
  sort_order smallint not null unique,
  is_active boolean not null default true
);

create table public.sks_statuses (
  slug text primary key,
  label text not null unique,
  sort_order smallint not null unique,
  is_active boolean not null default true
);

create table public.task_activation_statuses (
  slug text primary key,
  label text not null unique,
  sort_order smallint not null unique,
  is_active boolean not null default true
);

create table public.task_progress_statuses (
  slug text primary key,
  label text not null unique,
  sort_order smallint not null unique,
  is_active boolean not null default true
);

create table public.process_types (
  slug text primary key,
  label text not null unique,
  sort_order smallint not null unique,
  is_active boolean not null default true
);

create table public.coordinator_roles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null unique,
  sort_order smallint not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.periods (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text not null unique,
  starts_on date,
  ends_on date,
  is_active boolean not null default false,
  is_locked boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_on is null or ends_on is null or starts_on <= ends_on)
);

-- E-posta auth.users tablosunda kalir; ekip listesinde yalnizca gorunen ad tutulur.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.period_memberships (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.periods(id) on delete restrict,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  coordinator_role_id uuid not null references public.coordinator_roles(id) on delete restrict,
  app_role text not null default 'coordinator' check (app_role in ('super_admin', 'coordinator')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (period_id, profile_id)
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.periods(id) on delete restrict,
  title text not null check (char_length(trim(title)) > 0),
  description text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  owner_id uuid not null references public.profiles(id) on delete restrict,
  event_status text not null default 'idea' references public.event_statuses(slug),
  -- Bos deger, etkinlik olusturulurken SKS gerekip gerekmediginin henuz secilmedigini belirtir.
  sks_status text references public.sks_statuses(slug),
  planning_date date not null default current_date,
  estimated_date date,
  preparation_start_date date,
  confirmed_date date,
  venue text,
  next_action text,
  general_note text,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete set null,
  deletion_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (deleted_at is null or deleted_by is not null)
);

create table public.event_members (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  member_type text not null check (member_type in ('supporting', 'informed')),
  added_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (event_id, profile_id, member_type)
);

-- Bir surecin tek sahibi olabilir; sahibi ayni surece destekleyen veya bilgilendirilen kisiler ekleyebilir.
create table public.event_process_members (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  process_type text not null references public.process_types(slug),
  profile_id uuid not null references public.profiles(id) on delete restrict,
  responsibility_type text not null check (responsibility_type in ('owner', 'supporting', 'informed')),
  assigned_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (event_id, process_type, profile_id, responsibility_type)
);

create unique index event_process_members_one_owner_per_process
  on public.event_process_members(event_id, process_type)
  where responsibility_type = 'owner';

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  process_type text references public.process_types(slug),
  title text not null check (char_length(trim(title)) > 0),
  description text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  activation_status text not null default 'draft' references public.task_activation_statuses(slug),
  progress_status text not null default 'not_started' references public.task_progress_statuses(slug),
  starts_at timestamptz,
  deadline_at timestamptz,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  notes text,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete set null,
  deletion_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_at is null or deadline_at is null or starts_at <= deadline_at),
  check (deleted_at is null or deleted_by is not null)
);

create table public.task_assignees (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  assignment_type text not null check (assignment_type in ('primary', 'supporting', 'informed')),
  assigned_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (task_id, profile_id, assignment_type)
);

create unique index task_assignees_one_primary_per_task
  on public.task_assignees(task_id)
  where assignment_type = 'primary';

-- Bagimlilikler serbest metin degildir. Her satir tek bir tetikleyici tanimlar.
create table public.task_dependencies (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  dependency_type text not null check (dependency_type in ('sks_status', 'task_progress', 'event_date_offset')),
  source_event_id uuid references public.events(id) on delete cascade,
  source_task_id uuid references public.tasks(id) on delete cascade,
  required_sks_status text references public.sks_statuses(slug),
  required_task_progress_status text references public.task_progress_statuses(slug),
  offset_days integer,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (source_task_id is null or source_task_id <> task_id),
  check (
    (dependency_type = 'sks_status'
      and source_event_id is not null
      and source_task_id is null
      and required_sks_status is not null
      and required_task_progress_status is null
      and offset_days is null)
    or
    (dependency_type = 'task_progress'
      and source_event_id is null
      and source_task_id is not null
      and required_sks_status is null
      and required_task_progress_status is not null
      and offset_days is null)
    or
    (dependency_type = 'event_date_offset'
      and source_event_id is not null
      and source_task_id is null
      and required_sks_status is null
      and required_task_progress_status is null
      and offset_days is not null)
  )
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  notification_type text not null check (notification_type in (
    'task_assigned', 'task_updated', 'task_due_soon', 'task_overdue',
    'sks_status_changed', 'event_date_changed', 'event_member_added',
    'report_missing', 'link_missing', 'event_completed', 'dependency_activated',
    'dependency_review_required'
  )),
  channel text not null check (channel in ('in_app', 'email', 'push')),
  delivery_status text not null default 'queued' check (delivery_status in ('queued', 'sent', 'failed')),
  title text not null,
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  dedupe_key text,
  scheduled_for timestamptz not null default now(),
  sent_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index notifications_dedupe_key_unique
  on public.notifications(dedupe_key)
  where dedupe_key is not null;

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  entity_type text not null check (entity_type in ('event', 'task', 'event_process_member', 'task_assignee', 'task_dependency')),
  entity_id uuid not null,
  action text not null check (action in ('created', 'updated', 'deleted')),
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create index events_period_id_idx on public.events(period_id);
create index events_owner_id_idx on public.events(owner_id);
create index events_status_idx on public.events(event_status, sks_status);
create index tasks_event_id_idx on public.tasks(event_id);
create index tasks_deadline_idx on public.tasks(deadline_at) where deleted_at is null;
create index task_assignees_profile_id_idx on public.task_assignees(profile_id);
create index notifications_recipient_idx on public.notifications(recipient_id, read_at, scheduled_for desc);
create index audit_logs_entity_idx on public.audit_logs(entity_type, entity_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), 'Yeni Ekip Uyesi')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.is_active_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.period_memberships pm on pm.profile_id = p.id
    where p.id = auth.uid()
      and p.is_active
      and pm.is_active
  );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.period_memberships pm
    join public.profiles p on p.id = pm.profile_id
    where pm.profile_id = auth.uid()
      and pm.app_role = 'super_admin'
      and pm.is_active
      and p.is_active
  );
$$;

create or replace function public.is_period_locked(target_period_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_locked from public.periods where id = target_period_id), true);
$$;

create or replace function public.can_manage_event(target_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or exists (
      select 1
      from public.events e
      where e.id = target_event_id
        and e.owner_id = auth.uid()
    );
$$;

create or replace function public.can_manage_event_process(target_event_id uuid, target_process_type text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or exists (
      select 1
      from public.events e
      where e.id = target_event_id
        and e.owner_id = auth.uid()
    )
    or exists (
      select 1
      from public.event_process_members epm
      where epm.event_id = target_event_id
        and epm.process_type = target_process_type
        and epm.profile_id = auth.uid()
        and epm.responsibility_type = 'owner'
    );
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
      from public.tasks t
      join public.events e on e.id = t.event_id
      where t.id = target_task_id
        and e.owner_id = auth.uid()
    )
    or exists (
      select 1
      from public.tasks t
      join public.event_process_members epm
        on epm.event_id = t.event_id
       and epm.process_type = t.process_type
      where t.id = target_task_id
        and epm.profile_id = auth.uid()
        and epm.responsibility_type = 'owner'
    );
$$;

create or replace function public.is_task_assignee(target_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.task_assignees ta
    where ta.task_id = target_task_id
      and ta.profile_id = auth.uid()
      and ta.assignment_type in ('primary', 'supporting')
  );
$$;

create or replace function public.assert_event_period_unlocked()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not public.is_super_admin() and public.is_period_locked(new.period_id) then
    raise exception 'Bu donem kilitli oldugu icin kayit degistirilemez.';
  end if;
  return new;
end;
$$;

create or replace function public.assert_task_period_unlocked()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  target_period_id uuid;
begin
  select period_id into target_period_id from public.events where id = new.event_id;
  if not public.is_super_admin() and public.is_period_locked(target_period_id) then
    raise exception 'Bu donem kilitli oldugu icin gorev degistirilemez.';
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
  target_event_id uuid;
  target_period_id uuid;
begin
  if tg_table_name in ('event_members', 'event_process_members') then
    if tg_op = 'DELETE' then
      target_event_id := old.event_id;
    else
      target_event_id := new.event_id;
    end if;
  elsif tg_table_name in ('task_assignees', 'task_dependencies') then
    select t.event_id into target_event_id
    from public.tasks t
    where t.id = case when tg_op = 'DELETE' then old.task_id else new.task_id end;
  else
    raise exception 'Desteklenmeyen tablo: %', tg_table_name;
  end if;

  select e.period_id into target_period_id from public.events e where e.id = target_event_id;
  if not public.is_super_admin() and public.is_period_locked(target_period_id) then
    raise exception 'Bu donem kilitli oldugu icin ilgili kayit degistirilemez.';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
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

  if new.dependency_type in ('sks_status', 'event_date_offset')
    and new.source_event_id is distinct from task_event_id then
    raise exception 'Etkinlik tabanli bagimlilik ayni etkinlige bagli olmalidir.';
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

create or replace function public.enforce_event_insert_rules()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.event_status in ('completed', 'reported', 'archived')
    and coalesce(new.sks_status, '') not in ('not_required', 'approved') then
    raise exception 'SKS onayi olmadan etkinlik tamamlanmis olarak olusturulamaz.';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_event_write_permissions()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.is_super_admin() then
    return new;
  end if;

  if old.owner_id = auth.uid() then
    if new.owner_id is distinct from old.owner_id
      or new.created_by is distinct from old.created_by
      or new.period_id is distinct from old.period_id
      or new.sks_status is distinct from old.sks_status
      or new.deleted_at is distinct from old.deleted_at
      or new.deleted_by is distinct from old.deleted_by
      or new.deletion_note is distinct from old.deletion_note then
      raise exception 'Etkinlik sahibi bu alani degistiremez.';
    end if;

    if new.event_status in ('completed', 'reported', 'archived')
      and coalesce(new.sks_status, '') not in ('not_required', 'approved') then
      raise exception 'SKS onayi olmadan etkinlik tamamlanmis olarak isaretlenemez.';
    end if;
    return new;
  end if;

  if public.can_manage_event_process(old.id, 'sks') then
    if (to_jsonb(new) - array['sks_status', 'updated_at'])
       is distinct from
       (to_jsonb(old) - array['sks_status', 'updated_at']) then
      raise exception 'SKS sorumlusu yalnizca SKS durumunu degistirebilir.';
    end if;
    return new;
  end if;

  raise exception 'Bu etkinligi duzenleme yetkiniz yok.';
end;
$$;

create or replace function public.enforce_task_write_permissions()
returns trigger
language plpgsql
set search_path = public
as $$
begin
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

create or replace function public.protect_profile_admin_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not public.is_super_admin() and new.is_active is distinct from old.is_active then
    raise exception 'Kullanici aktifligi yalnizca Super Yonetici tarafindan degistirilebilir.';
  end if;
  return new;
end;
$$;

create or replace function public.record_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_logs (actor_id, entity_type, entity_id, action, after_data)
    values (auth.uid(), tg_argv[0], new.id, 'created', to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.audit_logs (actor_id, entity_type, entity_id, action, before_data, after_data)
    values (auth.uid(), tg_argv[0], new.id, 'updated', to_jsonb(old), to_jsonb(new));
    return new;
  else
    insert into public.audit_logs (actor_id, entity_type, entity_id, action, before_data)
    values (auth.uid(), tg_argv[0], old.id, 'deleted', to_jsonb(old));
    return old;
  end if;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger coordinator_roles_set_updated_at before update on public.coordinator_roles
for each row execute function public.set_updated_at();
create trigger periods_set_updated_at before update on public.periods
for each row execute function public.set_updated_at();
create trigger period_memberships_set_updated_at before update on public.period_memberships
for each row execute function public.set_updated_at();
create trigger events_set_updated_at before update on public.events
for each row execute function public.set_updated_at();
create trigger tasks_set_updated_at before update on public.tasks
for each row execute function public.set_updated_at();

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create trigger events_assert_period_unlocked before insert or update on public.events
for each row execute function public.assert_event_period_unlocked();
create trigger events_enforce_insert_rules before insert on public.events
for each row execute function public.enforce_event_insert_rules();
create trigger tasks_assert_period_unlocked before insert or update on public.tasks
for each row execute function public.assert_task_period_unlocked();
create trigger events_enforce_write_permissions before update on public.events
for each row execute function public.enforce_event_write_permissions();
create trigger tasks_enforce_write_permissions before update on public.tasks
for each row execute function public.enforce_task_write_permissions();
create trigger profiles_protect_admin_fields before update on public.profiles
for each row execute function public.protect_profile_admin_fields();
create trigger event_members_assert_period_unlocked before insert or update or delete on public.event_members
for each row execute function public.assert_related_event_period_unlocked();
create trigger event_process_members_assert_period_unlocked before insert or update or delete on public.event_process_members
for each row execute function public.assert_related_event_period_unlocked();
create trigger task_assignees_assert_period_unlocked before insert or update or delete on public.task_assignees
for each row execute function public.assert_related_event_period_unlocked();
create trigger task_dependencies_assert_period_unlocked before insert or update or delete on public.task_dependencies
for each row execute function public.assert_related_event_period_unlocked();
create trigger task_dependencies_assert_context before insert or update on public.task_dependencies
for each row execute function public.assert_task_dependency_context();

create trigger audit_events after insert or update or delete on public.events
for each row execute function public.record_audit_log('event');
create trigger audit_tasks after insert or update or delete on public.tasks
for each row execute function public.record_audit_log('task');
create trigger audit_event_process_members after insert or update or delete on public.event_process_members
for each row execute function public.record_audit_log('event_process_member');
create trigger audit_task_assignees after insert or update or delete on public.task_assignees
for each row execute function public.record_audit_log('task_assignee');
create trigger audit_task_dependencies after insert or update or delete on public.task_dependencies
for each row execute function public.record_audit_log('task_dependency');

alter table public.event_statuses enable row level security;
alter table public.sks_statuses enable row level security;
alter table public.task_activation_statuses enable row level security;
alter table public.task_progress_statuses enable row level security;
alter table public.process_types enable row level security;
alter table public.coordinator_roles enable row level security;
alter table public.periods enable row level security;
alter table public.profiles enable row level security;
alter table public.period_memberships enable row level security;
alter table public.events enable row level security;
alter table public.event_members enable row level security;
alter table public.event_process_members enable row level security;
alter table public.tasks enable row level security;
alter table public.task_assignees enable row level security;
alter table public.task_dependencies enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

create policy "active members read reference data" on public.event_statuses for select using (public.is_active_member());
create policy "admins manage event statuses" on public.event_statuses for all using (public.is_super_admin()) with check (public.is_super_admin());
create policy "active members read sks statuses" on public.sks_statuses for select using (public.is_active_member());
create policy "admins manage sks statuses" on public.sks_statuses for all using (public.is_super_admin()) with check (public.is_super_admin());
create policy "active members read task activation statuses" on public.task_activation_statuses for select using (public.is_active_member());
create policy "admins manage task activation statuses" on public.task_activation_statuses for all using (public.is_super_admin()) with check (public.is_super_admin());
create policy "active members read task progress statuses" on public.task_progress_statuses for select using (public.is_active_member());
create policy "admins manage task progress statuses" on public.task_progress_statuses for all using (public.is_super_admin()) with check (public.is_super_admin());
create policy "active members read process types" on public.process_types for select using (public.is_active_member());
create policy "admins manage process types" on public.process_types for all using (public.is_super_admin()) with check (public.is_super_admin());

create policy "active members read coordinator roles" on public.coordinator_roles for select using (public.is_active_member());
create policy "admins manage coordinator roles" on public.coordinator_roles for all using (public.is_super_admin()) with check (public.is_super_admin());
create policy "active members read periods" on public.periods for select using (public.is_active_member());
create policy "admins manage periods" on public.periods for all using (public.is_super_admin()) with check (public.is_super_admin());
create policy "active members read profiles" on public.profiles for select using (public.is_active_member());
create policy "members update own profile" on public.profiles for update using (id = auth.uid() or public.is_super_admin()) with check (id = auth.uid() or public.is_super_admin());
create policy "active members read memberships" on public.period_memberships for select using (public.is_active_member());
create policy "admins manage memberships" on public.period_memberships for all using (public.is_super_admin()) with check (public.is_super_admin());

create policy "active members read events" on public.events for select using (public.is_active_member());
create policy "members create own events" on public.events for insert with check (
  public.is_active_member()
  and created_by = auth.uid()
  and owner_id = auth.uid()
  and not public.is_period_locked(period_id)
);
create policy "authorized members update events" on public.events for update using (
  public.is_active_member()
  and (public.can_manage_event(id) or public.can_manage_event_process(id, 'sks'))
) with check (public.is_active_member());
create policy "admins permanently delete events" on public.events for delete using (public.is_super_admin());

create policy "active members read event members" on public.event_members for select using (public.is_active_member());
create policy "event managers add event members" on public.event_members for insert with check (
  public.is_active_member() and public.can_manage_event(event_id) and added_by = auth.uid()
);
create policy "event managers update event members" on public.event_members for update using (public.can_manage_event(event_id)) with check (public.can_manage_event(event_id));
create policy "event managers remove event members" on public.event_members for delete using (public.can_manage_event(event_id));

create policy "active members read process members" on public.event_process_members for select using (public.is_active_member());
create policy "authorized members add process members" on public.event_process_members for insert with check (
  public.is_active_member()
  and public.can_manage_event_process(event_id, process_type)
  and assigned_by = auth.uid()
);
create policy "authorized members update process members" on public.event_process_members for update using (
  public.can_manage_event_process(event_id, process_type)
) with check (public.can_manage_event_process(event_id, process_type));
create policy "authorized members remove process members" on public.event_process_members for delete using (
  public.can_manage_event_process(event_id, process_type)
);

create policy "active members read tasks" on public.tasks for select using (public.is_active_member());
create policy "event and process managers create tasks" on public.tasks for insert with check (
  public.is_active_member()
  and created_by = auth.uid()
  and (public.can_manage_event(event_id) or public.can_manage_event_process(event_id, process_type))
);
create policy "authorized members update tasks" on public.tasks for update using (
  public.is_active_member() and (public.can_manage_task(id) or public.is_task_assignee(id))
) with check (public.is_active_member());
create policy "admins permanently delete tasks" on public.tasks for delete using (public.is_super_admin());

create policy "active members read task assignees" on public.task_assignees for select using (public.is_active_member());
create policy "task managers add assignees" on public.task_assignees for insert with check (
  public.can_manage_task(task_id) and assigned_by = auth.uid()
);
create policy "task managers update assignees" on public.task_assignees for update using (public.can_manage_task(task_id)) with check (public.can_manage_task(task_id));
create policy "task managers remove assignees" on public.task_assignees for delete using (public.can_manage_task(task_id));

create policy "active members read task dependencies" on public.task_dependencies for select using (public.is_active_member());
create policy "task managers add dependencies" on public.task_dependencies for insert with check (
  public.can_manage_task(task_id) and created_by = auth.uid()
);
create policy "task managers update dependencies" on public.task_dependencies for update using (public.can_manage_task(task_id)) with check (public.can_manage_task(task_id));
create policy "task managers remove dependencies" on public.task_dependencies for delete using (public.can_manage_task(task_id));

create policy "recipients and admins read notifications" on public.notifications for select using (
  recipient_id = auth.uid() or public.is_super_admin()
);
create policy "recipients mark notifications read" on public.notifications for update using (
  recipient_id = auth.uid()
) with check (recipient_id = auth.uid());

create policy "active members read audit logs" on public.audit_logs for select using (public.is_active_member());

-- Uygulama bos baslar: yalnizca sabit secenekler ve 2026-2027 donem tanimi eklenir.
insert into public.event_statuses (slug, label, sort_order) values
  ('idea', 'Fikir', 10),
  ('planning', 'Planlanıyor', 20),
  ('confirmed', 'Kesinleşti', 30),
  ('postponed', 'Ertelendi', 40),
  ('completed', 'Gerçekleşti', 50),
  ('reported', 'Raporlandı', 60),
  ('cancelled', 'İptal', 70),
  ('archived', 'Arşivlendi', 80)
on conflict (slug) do nothing;

insert into public.sks_statuses (slug, label, sort_order) values
  ('not_required', 'Gerekli Değil', 10),
  ('application_preparing', 'Başvuru Hazırlanıyor', 20),
  ('application_submitted', 'Başvurusu Yapıldı', 30),
  ('under_review', 'İnceleme/Beklemede', 40),
  ('revision_requested', 'Revize İstendi', 50),
  ('approved', 'Onaylandı', 60),
  ('rejected', 'Reddedildi', 70)
on conflict (slug) do nothing;

insert into public.task_activation_statuses (slug, label, sort_order) values
  ('draft', 'Taslak', 10),
  ('active', 'Aktif', 20)
on conflict (slug) do nothing;

insert into public.task_progress_statuses (slug, label, sort_order) values
  ('not_started', 'Başlanmadı', 10),
  ('in_progress', 'Devam Ediyor', 20),
  ('waiting', 'Beklemede', 30),
  ('completed', 'Tamamlandı', 40),
  ('cancelled', 'İptal', 50)
on conflict (slug) do nothing;

insert into public.process_types (slug, label, sort_order) values
  ('sks', 'SKS', 10),
  ('budget', 'Bütçe', 20),
  ('technical', 'Teknik', 30),
  ('design', 'Tasarım', 40),
  ('press', 'Basın/Yayın', 50),
  ('logistics', 'Lojistik', 60)
on conflict (slug) do nothing;

insert into public.coordinator_roles (slug, name, sort_order) values
  ('president', 'Başkan', 10),
  ('epsa-communication-secretary', 'EPSA İletişim Sekreteri', 20),
  ('general-secretary', 'Genel Sekreter', 30),
  ('treasurer', 'Sayman', 40),
  ('twinnet-coordinator', 'Twinnet Koordinatörü', 50),
  ('public-relations-coordinator', 'Halkla İlişkiler Koordinatörü', 60),
  ('public-health-coordinator', 'Halk Sağlığı Koordinatörü', 70),
  ('project-and-education-coordinator', 'Proje ve Eğitim Koordinatörü', 80),
  ('social-events-coordinator', 'Sosyal Etkinlik Koordinatörü', 90),
  ('social-responsibility-coordinator', 'Sosyal Sorumluluk Koordinatörü', 100),
  ('logistics-coordinator', 'Lojistik Koordinatörü', 110),
  ('press-and-publication-coordinator', 'Basın Yayın Koordinatörü', 120),
  ('information-technologies-coordinator', 'Bilişim Teknolojileri Koordinatörü', 130),
  ('design-coordinator', 'Tasarım Koordinatörü', 140)
on conflict (slug) do nothing;

insert into public.periods (slug, label, starts_on, ends_on, is_active)
values ('2026-2027', '2026-2027 Dönemi', date '2026-09-01', date '2027-08-31', true)
on conflict (slug) do nothing;

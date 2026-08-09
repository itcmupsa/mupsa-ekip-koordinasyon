-- Farkındalık Paylaşımı ve 1 Temmuz akademik dönem kuralı.
-- Önceki migration dosyaları değiştirilmez; bu migration mevcut şemaya ek düzeltme yapar.

-- 2026-2027 dönemi 1 Temmuz 2026 - 30 Haziran 2027 aralığıdır.
update public.periods
set starts_on = date '2026-07-01',
    ends_on = date '2027-06-30'
where slug = '2026-2027';

-- Etkinlik hazırlığı kesin tarihten, yoksa tahmini tarihten 40 gün önce başlar.
create or replace function public.calculate_event_preparation_date()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.preparation_start_date := case
    when new.confirmed_date is not null then new.confirmed_date - 40
    when new.estimated_date is not null then new.estimated_date - 40
    else null
  end;
  return new;
end;
$$;

drop trigger if exists events_set_preparation_date on public.events;
create trigger events_set_preparation_date
before insert or update of estimated_date, confirmed_date, preparation_start_date
on public.events
for each row execute function public.calculate_event_preparation_date();

-- Mevcut kayıtların hazırlık tarihlerini migration sırasında güvenli şekilde düzelt.
alter table public.events disable trigger events_assert_period_unlocked;
alter table public.events disable trigger events_enforce_write_permissions;
update public.events
set preparation_start_date = case
  when confirmed_date is not null then confirmed_date - 40
  when estimated_date is not null then estimated_date - 40
  else null
end;
alter table public.events enable trigger events_assert_period_unlocked;
alter table public.events enable trigger events_enforce_write_permissions;

-- Audit türleri, önceki migration'larda eklenen tüm türleri ve farkındalığı kapsar.
alter table public.audit_logs drop constraint if exists audit_logs_entity_type_check;
alter table public.audit_logs add constraint audit_logs_entity_type_check check (
  entity_type in (
    'event', 'task', 'event_process_member', 'task_assignee', 'task_dependency',
    'period_membership', 'event_decision', 'event_report', 'event_link', 'event_file',
    'event_budget_sponsor', 'awareness_post'
  )
);

create table public.awareness_design_statuses (
  slug text primary key,
  label text not null unique,
  sort_order smallint not null unique,
  is_active boolean not null default true
);

create table public.awareness_announcement_statuses (
  slug text primary key,
  label text not null unique,
  sort_order smallint not null unique,
  is_active boolean not null default true
);

create table public.awareness_sharing_statuses (
  slug text primary key,
  label text not null unique,
  sort_order smallint not null unique,
  is_active boolean not null default true
);

create table public.awareness_record_check_statuses (
  slug text primary key,
  label text not null unique,
  sort_order smallint not null unique,
  is_active boolean not null default true
);

insert into public.awareness_design_statuses (slug, label, sort_order) values
  ('not_started', 'Başlanmadı', 10),
  ('in_progress', 'Devam Ediyor', 20),
  ('completed', 'Tamamlandı', 30)
on conflict (slug) do nothing;

insert into public.awareness_announcement_statuses (slug, label, sort_order) values
  ('not_started', 'Başlanmadı', 10),
  ('drafting', 'Hazırlanıyor', 20),
  ('approved', 'Onaylandı', 30)
on conflict (slug) do nothing;

insert into public.awareness_sharing_statuses (slug, label, sort_order) values
  ('not_shared', 'Paylaşılmadı', 10),
  ('scheduled', 'Zamanlandı', 20),
  ('shared', 'Paylaşıldı', 30)
on conflict (slug) do nothing;

insert into public.awareness_record_check_statuses (slug, label, sort_order) values
  ('pending_check', 'Kontrol Bekliyor', 10),
  ('checked', 'Kontrol Edildi', 20)
on conflict (slug) do nothing;

create table public.awareness_posts (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.periods(id) on delete restrict,
  awareness_name text not null check (char_length(trim(awareness_name)) > 0),
  scope text,
  start_date date,
  end_date date,
  estimated_date date,
  share_date date,
  preparation_start_date date,
  closing_date date,
  design_status text not null default 'not_started' references public.awareness_design_statuses(slug),
  announcement_text_status text not null default 'not_started' references public.awareness_announcement_statuses(slug),
  sharing_status text not null default 'not_shared' references public.awareness_sharing_statuses(slug),
  design_responsible_id uuid references public.profiles(id) on delete restrict,
  press_publication_responsible_id uuid references public.profiles(id) on delete restrict,
  record_check_status text not null default 'pending_check' references public.awareness_record_check_statuses(slug),
  next_action text,
  note text,
  drive_folder_url text check (drive_folder_url is null or drive_folder_url ~* '^https?://'),
  design_url text check (design_url is null or design_url ~* '^https?://'),
  share_url text check (share_url is null or share_url ~* '^https?://'),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete set null,
  deletion_note text,
  check (start_date is null or end_date is null or start_date <= end_date),
  check (deleted_at is null or deleted_by is not null)
);

create index awareness_posts_period_date_idx
  on public.awareness_posts(period_id, start_date, share_date);

create or replace function public.calculate_awareness_preparation_date()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.preparation_start_date := case
    when new.share_date is not null then new.share_date - 14
    when new.estimated_date is not null then new.estimated_date - 14
    else null
  end;
  return new;
end;
$$;

create or replace function public.validate_awareness_responsibles()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.design_responsible_id is not null and not exists (
    select 1 from public.period_memberships pm
    where pm.period_id = new.period_id
      and pm.profile_id = new.design_responsible_id
      and pm.is_active
  ) then
    raise exception 'Tasarım sorumlusu bu dönemin aktif üyesi değil.';
  end if;

  if new.press_publication_responsible_id is not null and not exists (
    select 1 from public.period_memberships pm
    where pm.period_id = new.period_id
      and pm.profile_id = new.press_publication_responsible_id
      and pm.is_active
  ) then
    raise exception 'Basın Yayın sorumlusu bu dönemin aktif üyesi değil.';
  end if;

  return new;
end;
$$;

drop trigger if exists awareness_posts_set_updated_at on public.awareness_posts;
create trigger awareness_posts_set_updated_at
before update on public.awareness_posts
for each row execute function public.set_updated_at();

drop trigger if exists awareness_set_preparation_date on public.awareness_posts;
create trigger awareness_set_preparation_date
before insert or update of share_date, estimated_date, preparation_start_date
on public.awareness_posts
for each row execute function public.calculate_awareness_preparation_date();

drop trigger if exists awareness_validate_responsibles on public.awareness_posts;
create trigger awareness_validate_responsibles
before insert or update of period_id, design_responsible_id, press_publication_responsible_id
on public.awareness_posts
for each row execute function public.validate_awareness_responsibles();

create or replace function public.can_manage_awareness(target_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or exists (
      select 1
      from public.awareness_posts ap
      where ap.id = target_id
        and (
          ap.created_by = auth.uid()
          or ap.design_responsible_id = auth.uid()
          or ap.press_publication_responsible_id = auth.uid()
        )
    );
$$;

create or replace function public.assert_awareness_period_unlocked()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.is_period_locked(new.period_id) then
    raise exception 'Bu dönem kilitli olduğu için farkındalık kaydı değiştirilemez.';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_awareness_write_permissions()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.period_id is distinct from old.period_id
     or new.created_by is distinct from old.created_by then
    raise exception 'Farkındalık dönemi ve oluşturan kişi değiştirilemez.';
  end if;

  if not public.is_super_admin() and not public.can_manage_awareness(old.id) then
    raise exception 'Bu farkındalık kaydını düzenleme yetkiniz yok.';
  end if;

  return new;
end;
$$;

drop trigger if exists awareness_assert_period_unlocked on public.awareness_posts;
create trigger awareness_assert_period_unlocked
before insert or update on public.awareness_posts
for each row execute function public.assert_awareness_period_unlocked();

drop trigger if exists awareness_enforce_write_permissions on public.awareness_posts;
create trigger awareness_enforce_write_permissions
before update on public.awareness_posts
for each row execute function public.enforce_awareness_write_permissions();

drop trigger if exists audit_awareness_posts on public.awareness_posts;
create trigger audit_awareness_posts
after insert or update or delete on public.awareness_posts
for each row execute function public.record_audit_log('awareness_post');

alter table public.awareness_design_statuses enable row level security;
alter table public.awareness_announcement_statuses enable row level security;
alter table public.awareness_sharing_statuses enable row level security;
alter table public.awareness_record_check_statuses enable row level security;
alter table public.awareness_posts enable row level security;

create policy "active members read awareness_design_statuses"
  on public.awareness_design_statuses for select using (public.is_active_member());
create policy "admins manage awareness_design_statuses"
  on public.awareness_design_statuses for all using (public.is_super_admin()) with check (public.is_super_admin());

create policy "active members read awareness_announcement_statuses"
  on public.awareness_announcement_statuses for select using (public.is_active_member());
create policy "admins manage awareness_announcement_statuses"
  on public.awareness_announcement_statuses for all using (public.is_super_admin()) with check (public.is_super_admin());

create policy "active members read awareness_sharing_statuses"
  on public.awareness_sharing_statuses for select using (public.is_active_member());
create policy "admins manage awareness_sharing_statuses"
  on public.awareness_sharing_statuses for all using (public.is_super_admin()) with check (public.is_super_admin());

create policy "active members read awareness_record_check_statuses"
  on public.awareness_record_check_statuses for select using (public.is_active_member());
create policy "admins manage awareness_record_check_statuses"
  on public.awareness_record_check_statuses for all using (public.is_super_admin()) with check (public.is_super_admin());

create policy "active members read awareness_posts"
  on public.awareness_posts for select using (public.is_active_member());

create policy "active period members create awareness_posts"
  on public.awareness_posts for insert
  with check (
    public.is_active_member()
    and created_by = auth.uid()
    and exists (
      select 1 from public.period_memberships pm
      where pm.period_id = awareness_posts.period_id
        and pm.profile_id = auth.uid()
        and pm.is_active
    )
  );

create policy "authorized members update awareness_posts"
  on public.awareness_posts for update
  using (public.is_active_member() and public.can_manage_awareness(id))
  with check (public.is_active_member());

-- Fiziksel DELETE policy yoktur; kayıt yaşam döngüsü soft-delete ile yönetilir.

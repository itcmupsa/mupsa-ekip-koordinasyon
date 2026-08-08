-- MUPSA Ekip Koordinasyon
-- Faz 2 / Adım 2C: event-files private Storage bucket ve RLS

insert into storage.buckets (id, name, public, file_size_limit)
values ('event-files', 'event-files', false, 5242880)
on conflict (id) do update set
  name = excluded.name,
  public = false,
  file_size_limit = 5242880;

drop policy if exists "active members read event files" on storage.objects;
drop policy if exists "event managers upload files" on storage.objects;
drop policy if exists "event managers update files" on storage.objects;
drop policy if exists "admins permanently delete storage objects" on storage.objects;

-- Dosya yolu: events/{event_id}/{unique_id}-{safe_file_name}
-- Event ID yalnızca metin olarak karşılaştırılır; geçersiz bir UUID path'i cast hatası üretmez.
create policy "active members read event files"
on storage.objects for select
using (
  bucket_id = 'event-files'
  and public.is_active_member()
  and (string_to_array(name, '/'))[1] = 'events'
  and exists (
    select 1
    from public.events e
    join public.periods p on p.id = e.period_id
    where e.id::text = (string_to_array(name, '/'))[2]
      and e.deleted_at is null
      and p.is_active
  )
);

create policy "event managers upload files"
on storage.objects for insert
with check (
  bucket_id = 'event-files'
  and public.is_active_member()
  and (string_to_array(name, '/'))[1] = 'events'
  and exists (
    select 1
    from public.events e
    join public.periods p on p.id = e.period_id
    where e.id::text = (string_to_array(name, '/'))[2]
      and e.deleted_at is null
      and p.is_active
      and public.can_manage_event(e.id)
      and not public.is_period_locked(e.period_id)
  )
);

create policy "event managers update files"
on storage.objects for update
using (
  bucket_id = 'event-files'
  and public.is_active_member()
  and (string_to_array(name, '/'))[1] = 'events'
  and exists (
    select 1
    from public.events e
    join public.periods p on p.id = e.period_id
    where e.id::text = (string_to_array(name, '/'))[2]
      and e.deleted_at is null
      and p.is_active
      and public.can_manage_event(e.id)
      and not public.is_period_locked(e.period_id)
  )
)
with check (
  bucket_id = 'event-files'
  and public.is_active_member()
  and (string_to_array(name, '/'))[1] = 'events'
  and exists (
    select 1
    from public.events e
    join public.periods p on p.id = e.period_id
    where e.id::text = (string_to_array(name, '/'))[2]
      and e.deleted_at is null
      and p.is_active
      and public.can_manage_event(e.id)
      and not public.is_period_locked(e.period_id)
  )
);

create policy "admins permanently delete storage objects"
on storage.objects for delete
using (
  bucket_id = 'event-files'
  and public.is_super_admin()
);

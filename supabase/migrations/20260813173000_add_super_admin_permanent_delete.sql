create or replace function public.permanently_delete_event(target_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then raise exception 'Bu işlem yalnızca Süper Yönetici tarafından yapılabilir.'; end if;
  if not exists (select 1 from public.events where id = target_event_id) then raise exception 'Etkinlik bulunamadı.'; end if;
  delete from public.events where id = target_event_id;
end;
$$;

create or replace function public.permanently_delete_task(target_task_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then raise exception 'Bu işlem yalnızca Süper Yönetici tarafından yapılabilir.'; end if;
  if not exists (select 1 from public.tasks where id = target_task_id) then raise exception 'Görev bulunamadı.'; end if;
  delete from public.tasks where id = target_task_id;
end;
$$;

create or replace function public.permanently_delete_awareness_post(target_awareness_post_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then raise exception 'Bu işlem yalnızca Süper Yönetici tarafından yapılabilir.'; end if;
  if not exists (select 1 from public.awareness_posts where id = target_awareness_post_id) then raise exception 'Farkındalık kaydı bulunamadı.'; end if;
  delete from public.tasks where awareness_post_id = target_awareness_post_id;
  delete from public.awareness_posts where id = target_awareness_post_id;
end;
$$;

create or replace function public.permanently_delete_calendar_entry(target_calendar_entry_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then raise exception 'Bu işlem yalnızca Süper Yönetici tarafından yapılabilir.'; end if;
  if not exists (select 1 from public.calendar_entries where id = target_calendar_entry_id) then raise exception 'Takvim kaydı bulunamadı.'; end if;
  delete from public.calendar_entries where id = target_calendar_entry_id;
end;
$$;

revoke all on function public.permanently_delete_event(uuid) from public;
revoke all on function public.permanently_delete_task(uuid) from public;
revoke all on function public.permanently_delete_awareness_post(uuid) from public;
revoke all on function public.permanently_delete_calendar_entry(uuid) from public;
grant execute on function public.permanently_delete_event(uuid) to authenticated;
grant execute on function public.permanently_delete_task(uuid) to authenticated;
grant execute on function public.permanently_delete_awareness_post(uuid) to authenticated;
grant execute on function public.permanently_delete_calendar_entry(uuid) to authenticated;

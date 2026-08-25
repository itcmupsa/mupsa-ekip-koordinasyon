-- Genel Sekretere manuel duyuru gönderme yetkisi verir ve kullanıcıya görünen
-- MUPİ marka adını mevcut bildirimlerde büyük harfli biçime taşır.

create or replace function public.can_send_manual_announcement()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or exists (
      select 1
      from public.period_memberships membership
      join public.periods period on period.id = membership.period_id
      join public.coordinator_roles role on role.id = membership.coordinator_role_id
      where membership.profile_id = auth.uid()
        and membership.is_active
        and period.is_active
        and role.is_active
        and role.slug = 'general-secretary'
    );
$$;

revoke all on function public.can_send_manual_announcement() from public;
grant execute on function public.can_send_manual_announcement() to authenticated;

drop policy if exists "super admins read admin announcements" on public.admin_announcements;
create policy "authorized senders read admin announcements"
  on public.admin_announcements for select
  using (public.is_super_admin() or created_by = auth.uid());

do $$
declare
  function_definition text;
begin
  select pg_get_functiondef(
    'public.send_admin_announcement(text,text,text,uuid[],uuid[],timestamp with time zone)'::regprocedure
  ) into function_definition;

  function_definition := replace(
    function_definition,
    'if not public.is_super_admin() then',
    'if not public.can_send_manual_announcement() then'
  );
  function_definition := replace(
    function_definition,
    'Yalnızca Süper Yöneticiler duyuru gönderebilir.',
    'Bu duyuruyu yalnızca Süper Yönetici veya Genel Sekreter gönderebilir.'
  );

  execute function_definition;
end;
$$;

update public.notifications
set title = 'MUPİ içerik önerisi'
where notification_type = 'ai_awareness_suggestion'
  and title is distinct from 'MUPİ içerik önerisi';

-- Canlıya uygulanırken mevcut farkındalık kayıtlarının insan oluşturucularını
-- dağıtım çıktısına yazar; veri değiştirmez.
do $$
declare
  audit_row record;
begin
  for audit_row in
    select post.awareness_name, profile.display_name, post.created_at
    from public.awareness_posts post
    join public.profiles profile on profile.id = post.created_by
    order by post.created_at
  loop
    raise notice 'FARKINDALIK_KAYDI: % | Kaydı giren: % | %',
      audit_row.awareness_name,
      audit_row.display_name,
      audit_row.created_at;
  end loop;
end;
$$;

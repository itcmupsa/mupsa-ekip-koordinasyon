-- Yeni uygulama ve PWA bildirimlerini MUPİ'nin tutarlı diliyle markalar.
-- Bildirimin işlevsel başlığı korunur; yalnızca uygun MUPİ ifadesi eklenir.

create or replace function public.brand_notification_as_mupi()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.title like 'MUPİ%' then
    return new;
  end if;

  if new.notification_type = 'calendar_entry_reminder'
     and new.metadata ->> 'classification' = 'exam_period' then
    new.title := 'MUPİ başarılar diler';
  elsif new.notification_type = 'calendar_entry_reminder'
        and new.metadata ->> 'classification' = 'holiday' then
    new.title := 'MUPİ’den iyi dilekler';
  elsif new.notification_type = 'admin_announcement' then
    new.title := 'MUPİ duyuruyor · ' || new.title;
  elsif new.notification_type = 'awareness_ai_suggestion' then
    new.title := 'MUPİ içerik önerisi';
  else
    new.title := 'MUPİ hatırlatıyor · ' || new.title;
  end if;

  return new;
end;
$$;

drop trigger if exists notifications_brand_as_mupi on public.notifications;
create trigger notifications_brand_as_mupi
before insert or update of title on public.notifications
for each row execute function public.brand_notification_as_mupi();

-- Henüz gönderilmemiş mevcut bildirimleri de aynı kurala geçirir.
update public.notifications
set title = title
where delivery_status = 'queued'
  and title not like 'MUPİ%';

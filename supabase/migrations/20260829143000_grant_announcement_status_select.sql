-- Duyuru/Yayın alanı, events tablosunda kolon bazlı SELECT kısıtı olduğu için
-- açıkça authenticated rolüne okunabilir olarak eklenmelidir.
grant select (announcement_status) on public.events to authenticated;

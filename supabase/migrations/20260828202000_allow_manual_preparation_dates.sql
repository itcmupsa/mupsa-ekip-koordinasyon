-- Hazırlık başlangıç tarihleri artık kullanıcı tarafından seçilir.
-- Mevcut kayıtların tarihleri korunur; yalnız yeni insert/update işlemlerinde otomatik ezme durdurulur.

create or replace function public.calculate_event_preparation_date()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  return new;
end;
$$;

create or replace function public.calculate_awareness_preparation_date()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  return new;
end;
$$;

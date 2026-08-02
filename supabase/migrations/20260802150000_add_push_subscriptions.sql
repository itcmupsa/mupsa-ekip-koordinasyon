-- Faz 1 / Push bildirim altyapisi
-- Bir kullanicinin birden fazla telefon veya tarayicida ayri abonelik kaydi olabilir.
-- Anahtarlar yalnizca push teslimat katmani tarafindan kullanilir; audit gecmisine yazilmaz.

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique check (char_length(trim(endpoint)) > 0),
  p256dh_key text not null check (char_length(trim(p256dh_key)) > 0),
  auth_key text not null check (char_length(trim(auth_key)) > 0),
  content_encoding text not null default 'aes128gcm',
  device_label text,
  user_agent text,
  is_active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  failed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index push_subscriptions_profile_id_idx
  on public.push_subscriptions(profile_id)
  where is_active;

create trigger push_subscriptions_set_updated_at before update on public.push_subscriptions
for each row execute function public.set_updated_at();

alter table public.push_subscriptions enable row level security;

create policy "users and admins read push subscriptions" on public.push_subscriptions for select using (
  profile_id = auth.uid() or public.is_super_admin()
);
create policy "users register their own push subscriptions" on public.push_subscriptions for insert with check (
  public.is_active_member() and profile_id = auth.uid()
);
create policy "users and admins update push subscriptions" on public.push_subscriptions for update using (
  profile_id = auth.uid() or public.is_super_admin()
) with check (
  profile_id = auth.uid() or public.is_super_admin()
);
create policy "users and admins remove push subscriptions" on public.push_subscriptions for delete using (
  profile_id = auth.uid() or public.is_super_admin()
);

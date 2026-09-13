-- Run after the theme-preferences migration has been applied. This script owns
-- its fixture data and always rolls it back, including the temporary auth users.

begin;

create temporary table user_theme_preference_test_ids (
  owner_id uuid not null,
  other_id uuid not null,
  period_id uuid not null
) on commit drop;

create or replace function pg_temp.assert_true(condition boolean, message text)
returns void
language plpgsql
as $$
begin
  if condition is distinct from true then
    raise exception 'Assertion failed: %', message;
  end if;
end;
$$;

create or replace function pg_temp.expect_error(statement text, message text)
returns void
language plpgsql
as $$
begin
  begin
    execute statement;
  exception when others then
    return;
  end;
  raise exception 'Expected error: %', message;
end;
$$;

grant select on user_theme_preference_test_ids to authenticated;

do $$
declare
  owner_user_id uuid := gen_random_uuid();
  other_user_id uuid := gen_random_uuid();
  active_period_id uuid := gen_random_uuid();
  role_id uuid;
begin
  select id into role_id from public.coordinator_roles order by sort_order limit 1;
  if role_id is null then
    raise exception 'Theme preference test needs a seeded coordinator role.';
  end if;

  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values
    (owner_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'theme-owner-' || owner_user_id || '@example.invalid', 'not-used', now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{"display_name":"Theme owner"}'::jsonb, now(), now()),
    (other_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'theme-other-' || other_user_id || '@example.invalid', 'not-used', now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{"display_name":"Theme other"}'::jsonb, now(), now());

  insert into public.periods (id, slug, label, is_active)
  values (active_period_id, 'theme-test-' || active_period_id, 'Theme test ' || active_period_id, true);

  insert into public.period_memberships (period_id, profile_id, coordinator_role_id, app_role, is_active, period_display_name)
  values
    (active_period_id, owner_user_id, role_id, 'coordinator', true, 'Theme owner'),
    (active_period_id, other_user_id, role_id, 'coordinator', true, 'Theme other');

  insert into user_theme_preference_test_ids values (owner_user_id, other_user_id, active_period_id);
end;
$$;

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', owner_id::text, true) from user_theme_preference_test_ids;
set local role authenticated;

insert into public.user_theme_preferences (profile_id, color)
select owner_id, '#2E7D32' from user_theme_preference_test_ids
on conflict (profile_id) do update set color = excluded.color;

insert into public.user_theme_preferences (profile_id, color)
select owner_id, '#1266CC' from user_theme_preference_test_ids
on conflict (profile_id) do update set color = excluded.color;

select pg_temp.assert_true(
  exists (
    select 1 from public.user_theme_preferences
    where profile_id = owner_id and color = '#1266CC'
  ),
  'active owner can read and upsert their theme preference'
) from user_theme_preference_test_ids;

select pg_temp.expect_error(
  format(
    'update public.user_theme_preferences set color = %L where profile_id = %L::uuid',
    '#12345', owner_id
  ),
  'invalid hexadecimal colour is rejected'
) from user_theme_preference_test_ids;

select pg_temp.expect_error(
  format(
    'update public.user_theme_preferences set profile_id = %L::uuid where profile_id = %L::uuid',
    other_id, owner_id
  ),
  'profile owner is immutable'
) from user_theme_preference_test_ids;

reset role;
select set_config('request.jwt.claim.sub', other_id::text, true) from user_theme_preference_test_ids;
set local role authenticated;

select pg_temp.assert_true(
  not exists (
    select 1 from public.user_theme_preferences where profile_id = owner_id
  ),
  'another active user cannot read the owner preference'
) from user_theme_preference_test_ids;

select pg_temp.expect_error(
  format(
    'insert into public.user_theme_preferences (profile_id, color) values (%L::uuid, %L)',
    owner_id, '#111111'
  ),
  'another active user cannot create a preference for the owner'
) from user_theme_preference_test_ids;

with attempted_update as (
  update public.user_theme_preferences
  set color = '#111111'
  where profile_id = (select owner_id from user_theme_preference_test_ids)
  returning profile_id
)
select pg_temp.assert_true(
  count(*) = 0,
  'another active user cannot update the owner preference'
)
from attempted_update;

reset role;

select pg_temp.assert_true(
  (select color from public.user_theme_preferences where profile_id = owner_id) = '#1266CC',
  'denied update leaves the owner preference unchanged'
) from user_theme_preference_test_ids;

select pg_temp.assert_true(
  not has_table_privilege('anon', 'public.user_theme_preferences', 'SELECT'),
  'anonymous read privilege is absent'
);

select pg_temp.assert_true(
  not has_table_privilege('authenticated', 'public.user_theme_preferences', 'DELETE'),
  'authenticated delete privilege is absent'
);

rollback;

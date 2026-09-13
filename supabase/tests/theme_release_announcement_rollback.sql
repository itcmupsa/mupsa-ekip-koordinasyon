-- Canlı Supabase SQL Editor'da migration uygulandıktan sonra çalıştırılır.
-- Tüm kullanıcı/dönem verisi bu transaction içinde oluşturulur ve ROLLBACK ile silinir.
begin;

create or replace function pg_temp.assert_true(condition boolean, message text)
returns void
language plpgsql
as $$
begin
  if condition is distinct from true then
    raise exception '%', message;
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
    raise exception '%: expected an error', message;
  exception when others then
    if sqlerrm like '%expected an error' then
      raise;
    end if;
  end;
end;
$$;

create temporary table theme_release_test_ids (
  target_period_id uuid not null,
  other_active_period_id uuid not null,
  inactive_period_id uuid not null,
  empty_active_period_id uuid not null,
  eligible_profile_id uuid not null
);

create temporary table theme_release_subscription_count as
select count(*)::integer as count from public.push_subscriptions;

grant select on theme_release_test_ids to authenticated, service_role;
grant select on theme_release_subscription_count to authenticated, service_role;

do $$
declare
  target_period_id uuid := gen_random_uuid();
  other_active_period_id uuid := gen_random_uuid();
  inactive_period_id uuid := gen_random_uuid();
  empty_active_period_id uuid := gen_random_uuid();
  eligible_profile_id uuid := gen_random_uuid();
  inactive_membership_profile_id uuid := gen_random_uuid();
  inactive_profile_id uuid := gen_random_uuid();
  other_period_profile_id uuid := gen_random_uuid();
  role_id uuid := gen_random_uuid();
  role_sort_order smallint;
begin
  select (coalesce(max(sort_order), 0) + 1)::smallint
  into role_sort_order
  from public.coordinator_roles;

  insert into public.coordinator_roles (id, slug, name, sort_order, is_active)
  values (role_id, 'theme-release-test-' || role_id, 'Theme release test ' || role_id, role_sort_order, true);

  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values
    (eligible_profile_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'theme-release-eligible-' || eligible_profile_id || '@example.invalid', 'not-used', now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{"display_name":"Theme release eligible"}'::jsonb, now(), now()),
    (inactive_membership_profile_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'theme-release-inactive-membership-' || inactive_membership_profile_id || '@example.invalid', 'not-used', now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{"display_name":"Theme release inactive membership"}'::jsonb, now(), now()),
    (inactive_profile_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'theme-release-inactive-profile-' || inactive_profile_id || '@example.invalid', 'not-used', now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{"display_name":"Theme release inactive profile"}'::jsonb, now(), now()),
    (other_period_profile_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'theme-release-other-period-' || other_period_profile_id || '@example.invalid', 'not-used', now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{"display_name":"Theme release other period"}'::jsonb, now(), now());

  alter table public.profiles disable trigger user;
  update public.profiles set is_active = false where id = inactive_profile_id;
  alter table public.profiles enable trigger user;

  insert into public.periods (id, slug, label, starts_on, ends_on, is_active)
  values
    (target_period_id, 'theme-release-target-' || target_period_id, 'Theme release target ' || target_period_id, current_date, current_date + 30, true),
    (other_active_period_id, 'theme-release-other-' || other_active_period_id, 'Theme release other ' || other_active_period_id, current_date, current_date + 30, true),
    (inactive_period_id, 'theme-release-inactive-' || inactive_period_id, 'Theme release inactive ' || inactive_period_id, current_date, current_date + 30, false),
    (empty_active_period_id, 'theme-release-empty-' || empty_active_period_id, 'Theme release empty ' || empty_active_period_id, current_date, current_date + 30, true);

  insert into public.period_memberships (
    period_id, profile_id, coordinator_role_id, app_role, is_active, period_display_name
  ) values
    (target_period_id, eligible_profile_id, role_id, 'coordinator', true, 'Theme release eligible'),
    (target_period_id, inactive_membership_profile_id, role_id, 'coordinator', false, 'Inactive membership'),
    (target_period_id, inactive_profile_id, role_id, 'coordinator', true, 'Inactive profile'),
    (other_active_period_id, other_period_profile_id, role_id, 'coordinator', true, 'Other period member');

  insert into theme_release_test_ids values (
    target_period_id, other_active_period_id, inactive_period_id, empty_active_period_id, eligible_profile_id
  );
end;
$$;

select pg_temp.assert_true(
  not has_function_privilege('authenticated', 'public.queue_theme_release_announcement(uuid)', 'execute'),
  'authenticated role cannot invoke the release announcement function'
);
select pg_temp.assert_true(
  has_function_privilege('service_role', 'public.queue_theme_release_announcement(uuid)', 'execute'),
  'service_role can invoke the release announcement function'
);

set local role authenticated;
select pg_temp.expect_error(
  format('select public.queue_theme_release_announcement(%L::uuid)', target_period_id),
  'authenticated caller is rejected'
) from theme_release_test_ids;
reset role;

set local role service_role;
select pg_temp.expect_error(
  'select public.queue_theme_release_announcement(null)',
  'null target period is rejected'
);
select pg_temp.expect_error(
  format('select public.queue_theme_release_announcement(%L::uuid)', inactive_period_id),
  'inactive target period is rejected'
) from theme_release_test_ids;
select pg_temp.expect_error(
  format('select public.queue_theme_release_announcement(%L::uuid)', empty_active_period_id),
  'active target without recipients is rejected'
) from theme_release_test_ids;

create temporary table theme_release_test_result as
select public.queue_theme_release_announcement(target_period_id) as result
from theme_release_test_ids;
reset role;

select pg_temp.assert_true(
  (select result ->> 'already_queued' from theme_release_test_result) = 'false',
  'first service-role invocation queues the release'
);
select pg_temp.assert_true(
  (select (result ->> 'recipient_count')::integer from theme_release_test_result) = 1,
  'only the active profile with an active membership in the explicit target period is queued'
);
select pg_temp.assert_true(
  (select count(*) from public.notifications
   where metadata ->> 'release_key' = 'user-theme-pwa-announcement-20260912'
     and channel = 'in_app') = 1,
  'one in-app queue item exists for the one eligible fixture recipient'
);
select pg_temp.assert_true(
  exists (
    select 1 from public.notifications, theme_release_test_ids
    where metadata ->> 'release_key' = 'user-theme-pwa-announcement-20260912'
      and channel = 'in_app'
      and recipient_id = eligible_profile_id
      and title = 'MUPİ duyuruyor · Tema rengini seçebilirsin'
      and body = 'Ayarlar → Görünüm bölümünden uygulamanın rengini kişiselleştirebilirsin.'
      and metadata ->> 'url' = '/app/ayarlar?section=appearance'
  ),
  'MUPİ title, body, recipient, and safe settings deep link are preserved'
);
select pg_temp.assert_true(
  not exists (
    select 1 from public.notifications
    where metadata ->> 'release_key' = 'user-theme-pwa-announcement-20260912'
      and channel = 'email'
  ),
  'release announcement never creates email notifications'
);
select pg_temp.assert_true(
  (select count(*) from public.notifications
   where metadata ->> 'release_key' = 'user-theme-pwa-announcement-20260912'
     and channel = 'push') = 1,
  'existing in-app-to-push trigger creates one push queue item per recipient'
);
select pg_temp.assert_true(
  (select count from theme_release_subscription_count) = (select count(*) from public.push_subscriptions),
  'release announcement does not create, reactivate, or change push subscriptions'
);
select pg_temp.assert_true(
  exists (
    select 1 from public.release_announcements, theme_release_test_ids
    where release_key = 'user-theme-pwa-announcement-20260912'
      and period_id = target_period_id
      and recipient_count = 1
      and target_url = '/app/ayarlar?section=appearance'
  ),
  'release audit row records the explicit target period and recipient count'
);

set local role service_role;
create temporary table theme_release_repeat_result as
select public.queue_theme_release_announcement(target_period_id) as result
from theme_release_test_ids;
select pg_temp.expect_error(
  format('select public.queue_theme_release_announcement(%L::uuid)', other_active_period_id),
  'the same release key cannot silently target a different active period'
) from theme_release_test_ids;
reset role;

select pg_temp.assert_true(
  (select result ->> 'already_queued' from theme_release_repeat_result) = 'true',
  'second invocation for the same period reports the existing release'
);
select pg_temp.assert_true(
  (select count(*) from public.notifications
   where metadata ->> 'release_key' = 'user-theme-pwa-announcement-20260912'
     and channel = 'in_app') = 1,
  'sequential idempotence keeps one in-app release notification per recipient'
);

rollback;
select 'PASS_THEME_RELEASE_ANNOUNCEMENT' as result;

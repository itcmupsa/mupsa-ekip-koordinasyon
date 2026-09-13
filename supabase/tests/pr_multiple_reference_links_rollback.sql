-- Run after pr_calendar_predeploy_rollback.sql and
-- pr_link_channels_rollback.sql inside the same rollback transaction.

reset role;
update public.periods set is_locked = false where id in (select active_period_id from pr_calendar_test_ids);
select set_config('request.jwt.claim.sub', press_id::text, true) from pr_calendar_test_ids;
set local role authenticated;

update public.pr_calendar_entries
set reference_links = jsonb_build_array(
  jsonb_build_object('id', gen_random_uuid()::text, 'label', 'Instagram gönderisi', 'url', 'https://instagram.com/p/example'),
  jsonb_build_object('id', gen_random_uuid()::text, 'label', 'Drive dosyası', 'url', 'https://drive.google.com/example')
)
where title = 'PR calendar behavioral entry';

select pg_temp.assert_true(
  exists (
    select 1 from public.pr_calendar_entries
    where title = 'PR calendar behavioral entry'
      and jsonb_array_length(reference_links) = 2
      and reference_links -> 0 ->> 'label' = 'Instagram gönderisi'
      and reference_links -> 1 ->> 'label' = 'Drive dosyası'
  ),
  'multiple named links round trip under manager RLS'
);

select pg_temp.assert_true(
  not exists (
    select 1 from public.audit_logs audit
    where audit.entity_type = 'pr_calendar_entry'
      and (audit.after_data ? 'reference_links' or audit.before_data ? 'reference_links')
  ),
  'PR audit whitelist omits named link URLs'
);

select pg_temp.expect_error(
  'update public.pr_calendar_entries set reference_links = ''[{"id":"one","label":"Eksik adres","url":""}]''::jsonb where title = ''PR calendar behavioral entry''',
  'blank URLs rejected'
);
select pg_temp.expect_error(
  'update public.pr_calendar_entries set reference_links = ''[{"id":"one","label":"Güvensiz","url":"javascript:alert(1)"}]''::jsonb where title = ''PR calendar behavioral entry''',
  'non-HTTP protocols rejected'
);
select pg_temp.expect_error(
  'update public.pr_calendar_entries set reference_links = ''[{"id":"one","label":"Bir","url":"https://example.com"},{"id":"two","label":"İki","url":"https://example.com"}]''::jsonb where title = ''PR calendar behavioral entry''',
  'duplicate URLs rejected'
);
select pg_temp.expect_error(
  'update public.pr_calendar_entries set reference_links = ''{"id":"not-an-array"}''::jsonb where title = ''PR calendar behavioral entry''',
  'non-array links rejected'
);

update public.pr_calendar_entries
set reference_links = '[]'::jsonb, reference_label = null, reference_url = null
where title = 'PR calendar behavioral entry';
select pg_temp.assert_true(
  exists (
    select 1 from public.pr_calendar_entries
    where title = 'PR calendar behavioral entry'
      and reference_links = '[]'::jsonb
  ),
  'all links can be removed'
);

reset role;

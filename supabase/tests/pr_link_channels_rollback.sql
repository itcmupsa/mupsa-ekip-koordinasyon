-- Run after pr_calendar_predeploy_rollback.sql inside the same rollback transaction.

reset role;
update public.periods set is_locked = false where id in (select active_period_id from pr_calendar_test_ids);
select set_config('request.jwt.claim.sub', press_id::text, true) from pr_calendar_test_ids;
set local role authenticated;
update public.pr_calendar_entries set channels = array['Instagram','WhatsApp'], channel = 'Instagram', reference_label = 'Tasarım dosyası' where title = 'PR calendar behavioral entry';
select pg_temp.assert_true(exists(select 1 from public.pr_calendar_entries where title = 'PR calendar behavioral entry' and channels = array['Instagram','WhatsApp'] and reference_label = 'Tasarım dosyası'), 'multiple channels and link name round trip under manager RLS');
select pg_temp.expect_error('update public.pr_calendar_entries set channels = array[''Instagram'',''instagram''] where title = ''PR calendar behavioral entry''', 'duplicate channels rejected');
select pg_temp.expect_error('update public.pr_calendar_entries set channels = array[''''] where title = ''PR calendar behavioral entry''', 'blank channels rejected');
select pg_temp.expect_error('update public.pr_calendar_entries set reference_label = repeat(''x'',161) where title = ''PR calendar behavioral entry''', 'oversized link name rejected');
update public.pr_calendar_entries set channels = array[]::text[], channel = null where title = 'PR calendar behavioral entry';
select pg_temp.assert_true(exists(select 1 from public.pr_calendar_entries where title = 'PR calendar behavioral entry' and cardinality(channels) = 0), 'all channels can be removed');
reset role;

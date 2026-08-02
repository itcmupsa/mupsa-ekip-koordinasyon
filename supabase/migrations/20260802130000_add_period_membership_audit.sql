-- Faz 1 / Adım 1 düzeltmesi:
-- Dönem üyeliği değişiklikleri; rol atama, süper yönetici yetkisi,
-- aktif/pasif durumu ve üyelik silinmesi dahil audit geçmişine yazılır.

alter table public.audit_logs
  drop constraint if exists audit_logs_entity_type_check;

alter table public.audit_logs
  add constraint audit_logs_entity_type_check
  check (entity_type in (
    'event',
    'task',
    'event_process_member',
    'task_assignee',
    'task_dependency',
    'period_membership'
  ));

create trigger audit_period_memberships
after insert or update or delete on public.period_memberships
for each row execute function public.record_audit_log('period_membership');

-- Tasarım süreci artık Duyuru/Yayın'dan ayrı tutulduğu için eski birleşik seçenekleri temizle.

update public.event_design_announcement_statuses
set label = 'Revizede'
where slug = 'revision';

update public.event_design_announcement_statuses
set is_active = false
where slug = 'published';

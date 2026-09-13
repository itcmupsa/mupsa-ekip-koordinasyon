-- Store ordered, named PR reference links while retaining the first link in
-- the legacy columns for older clients.
create function public.is_valid_pr_reference_links(link_list jsonb)
returns boolean
language sql
immutable
set search_path = public
as $$
  select case
    when link_list is null or jsonb_typeof(link_list) <> 'array' then false
    else
      jsonb_array_length(link_list) <= 20
      and not exists (
        select 1
        from jsonb_array_elements(link_list) link
        where jsonb_typeof(link) <> 'object'
          or jsonb_typeof(link -> 'id') is distinct from 'string'
          or jsonb_typeof(link -> 'label') is distinct from 'string'
          or jsonb_typeof(link -> 'url') is distinct from 'string'
          or char_length(trim(link ->> 'id')) not between 1 and 100
          or char_length(trim(link ->> 'label')) not between 1 and 160
          or char_length(trim(link ->> 'url')) not between 1 and 2048
          or (link ->> 'url') !~* '^https?://.+'
      )
      and jsonb_array_length(link_list) = (
        select count(distinct lower(trim(link ->> 'id')))
        from jsonb_array_elements(link_list) link
      )
      and jsonb_array_length(link_list) = (
        select count(distinct lower(trim(link ->> 'url')))
        from jsonb_array_elements(link_list) link
      )
  end;
$$;

alter table public.pr_calendar_entries
  add column reference_links jsonb not null default '[]'::jsonb
  check (public.is_valid_pr_reference_links(reference_links));

alter table public.pr_calendar_entries disable trigger audit_pr_calendar_entries;
update public.pr_calendar_entries
set reference_links = jsonb_build_array(jsonb_build_object(
  'id', gen_random_uuid()::text,
  'label', coalesce(nullif(trim(reference_label), ''), 'Harici bağlantı'),
  'url', trim(reference_url)
))
where reference_url is not null;
alter table public.pr_calendar_entries enable trigger audit_pr_calendar_entries;

comment on column public.pr_calendar_entries.reference_links is
  'Ordered named links. Current clients mirror the first item into reference_label/reference_url for backwards compatibility.';

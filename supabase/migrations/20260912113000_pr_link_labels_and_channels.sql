-- Additive: preserve old channel values without rewriting existing records.
create function public.is_valid_pr_channels(values_list text[])
returns boolean language sql immutable set search_path = public as $$
  select values_list is null or (
    cardinality(values_list) <= 20
    and array_position(values_list, null) is null
    and not exists(select 1 from unnest(values_list) item where char_length(trim(item)) not between 1 and 120)
    and cardinality(values_list) = (select count(distinct lower(trim(item))) from unnest(values_list) item)
  );
$$;
alter table public.pr_calendar_entries
  add column channels text[] check (public.is_valid_pr_channels(channels)),
  add column reference_label text check (reference_label is null or char_length(trim(reference_label)) between 1 and 160);
-- NULL channels means a legacy row: clients fall back to the original channel.
-- [] explicitly means no channel. New clients mirror the first channel to the
-- old field for older frontends; no RLS/grant or approval changes are required.

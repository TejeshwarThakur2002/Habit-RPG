-- Which completion dealt which damage (DECISIONS.md D58). A retried sync can never hit the boss
-- twice, and undoing a completion gives back exactly what it dealt, even when the boss's HP
-- stopped the hit short. No foreign key: the battle log outlives deleted completions.
alter table public.party_events add column completion_id uuid;

create unique index party_events_one_per_completion on public.party_events (completion_id, kind)
  where completion_id is not null;

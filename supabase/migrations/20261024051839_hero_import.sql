-- Importing a linked local hero (DECISIONS.md D42). While its history is still arriving, over
-- several syncs, the hero is marked so that only import requests reach it.
alter table public.characters add column importing boolean not null default false;

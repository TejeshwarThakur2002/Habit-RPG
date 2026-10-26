-- Keeping a phone's hero over the account's (DECISIONS.md D49).
--
-- Replacing the account's hero deletes its rows outright, so no pull can tell another phone
-- they are gone. The replacing hero's profile records the sync_seq value it was made at: a
-- phone whose cursor is below it still holds the old hero, and is told to start again.
alter table public.profiles add column replaced_seq bigint;

-- An import arrives over several syncs (D42); only the phone that started it may continue it.
alter table public.characters add column import_device uuid;

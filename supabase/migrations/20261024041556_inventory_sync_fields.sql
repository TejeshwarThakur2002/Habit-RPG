-- Syncing gear (SCOPE.md section 8.3, DECISIONS.md D39). `equipped` is last write wins, so
-- the phone's time is kept as it is for habits. Undoing a purchase leaves a tombstone instead
-- of deleting the row, so the pull can tell the phone's other copies to drop it.

alter table public.inventory
  add column client_updated_at timestamptz,
  add column deleted_at timestamptz;
update public.inventory set client_updated_at = purchased_at;
alter table public.inventory
  alter column client_updated_at set not null,
  add constraint undone_gear_is_not_worn check (deleted_at is null or not equipped);

-- An item is still owned only once, but an undone purchase no longer counts, so the player
-- can buy it again.
alter table public.inventory drop constraint inventory_user_id_item_id_key;
create unique index one_owned_item_per_player
  on public.inventory (user_id, item_id)
  where deleted_at is null;

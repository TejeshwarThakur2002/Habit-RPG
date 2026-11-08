-- A deleted account's battle-log lines stay, so the party's history still adds up, but lose who
-- dealt them and the player's own quest name (DECISIONS.md D64; deferred from P4 to P5). A
-- trigger on the login covers every way an account goes: `delete-account`, the dashboard, an
-- admin script.
create function private.anonymise_party_history() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.party_events set user_id = null, habit_name = null where user_id = old.id;
  return old;
end;
$$;

revoke execute on function private.anonymise_party_history() from public, anon, authenticated;

create trigger anonymise_party_history
  before delete on auth.users
  for each row execute function private.anonymise_party_history();

// Two phones in one party against the local stack's real `party` and `sync` functions (P5's
// "done when", D64): one member's hit reaches the other over Realtime within 5 seconds and a
// stranger hears nothing; both phones store the same fight; the reward pays out once each and
// counts as a trophy; leaving clears the party from the leaver's phone only.

import type { SupabaseClient } from '@supabase/supabase-js';

import { completeHabit } from '../../db/queries/completions';
import { createHabit } from '../../db/queries/habits';
import { getCharacter } from '../../db/queries/hero';
import { createHero, recordSignIn } from '../../db/queries/local-data';
import { getPartyView, saveParty } from '../../db/queries/party';
import {
  deleteAccount,
  newAccount,
  partyCall,
  realtimeClient,
  setBossHp,
  type TestAccount,
} from '../../test/sync-stack';
import { PLAYER, newPhone, type TestPhone } from '../../test/test-phone';

const newId = () => crypto.randomUUID();
const accounts: TestAccount[] = [];
const clients: SupabaseClient[] = [];

afterAll(async () => {
  for (const client of clients) await client.removeAllChannels();
  for (const account of accounts) await deleteAccount(account);
});

/** A signed-in phone whose hero and one daily quest are on the server. */
async function player(
  name: string,
): Promise<{ phone: TestPhone; account: TestAccount; quest: string }> {
  const account = await newAccount();
  accounts.push(account);
  const phone = await newPhone(name, account);
  recordSignIn(phone.db, { id: account.id, email: `${name}@example.com` });
  createHero(phone.db, { heroName: name, heroClass: 'mage', timeZone: 'UTC', now: Date.now() });
  const quest = newId();
  createHabit(phone.db, {
    userId: PLAYER,
    id: quest,
    now: Date.now(),
    fields: {
      name: `${name}'s run`,
      type: 'daily',
      difficulty: 'hard',
      category: 'body',
      weekdays: 127,
      reminderTime: null,
    },
  });
  expect(await phone.service.firstSync(account.id)).toMatchObject({ status: 'done' });
  return { phone, account, quest };
}

/** What the app does after an action, on focus and after a sync: store the snapshot. */
async function refresh(p: { phone: TestPhone; account: TestAccount }) {
  const answer = await partyCall(p.account, { action: 'state' });
  if (!('state' in answer)) throw new Error(answer.error);
  saveParty(p.phone.db, answer.state, p.account.id, Date.now());
  return getPartyView(p.phone.db, Date.now());
}

/**
 * Listens to the party's battle log as `account`. `ready` resolves once subscribed; `heard`
 * with how long the first line took to arrive after `ready`, or null after `ms`.
 */
function listen(account: TestAccount, partyId: string, ms: number) {
  const client = realtimeClient(account);
  clients.push(client);
  let start = 0;
  let markReady = () => {};
  const ready = new Promise<void>((resolve) => (markReady = resolve));
  const heard = new Promise<number | null>((resolve, reject) => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    client
      .channel(`party-events:${partyId}:${account.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'party_events',
          filter: `party_id=eq.${partyId}`,
        },
        () => {
          clearTimeout(timeout);
          resolve(Date.now() - start);
        },
      )
      .subscribe((status, error) => {
        if (error) return reject(error);
        if (status !== 'SUBSCRIBED') return;
        start = Date.now();
        timeout = setTimeout(() => resolve(null), ms);
        markReady();
      });
  });
  return { ready, heard };
}

test('two members fight one boss: live hits, the same fight on both phones, one reward each', async () => {
  const ada = await player('Ada');
  const bo = await player('Bo');
  const stranger = await player('Cy');

  const made = await partyCall(ada.account, { action: 'create', name: 'Night Owls' });
  if (!('state' in made) || !made.state.party) throw new Error('create failed');
  const { id: partyId, code } = made.state.party;
  const joined = await partyCall(bo.account, { action: 'join', code: code.toLowerCase() });
  expect('state' in joined).toBe(true);

  // Ada's tab is open; a stranger listens to the same party.
  const adaHears = listen(ada.account, partyId, 5_000);
  const strangerHears = listen(stranger.account, partyId, 5_000);
  await Promise.all([adaHears.ready, strangerHears.ready]);
  completeHabit(bo.phone.db, { userId: PLAYER, habitId: bo.quest, now: Date.now(), newId });
  await bo.phone.sync();
  const delay = await adaHears.heard;
  expect(delay).not.toBeNull();
  expect(delay!).toBeLessThan(5_000);
  expect(await strangerHears.heard).toBeNull();

  // Both phones store the same fight, each seeing itself as "you".
  const onAda = (await refresh(ada))!;
  const onBo = (await refresh(bo))!;
  const hit = onAda.members.find((m) => m.name === 'Bo')!.damage;
  expect(hit).toBeGreaterThan(0);
  expect(onAda.boss?.currentHp).toBe(onAda.boss!.maxHp - hit);
  expect(onBo.boss?.currentHp).toBe(onAda.boss?.currentHp);
  expect(onAda.members.find((m) => m.isYou)?.name).toBe('Ada');
  expect(onBo.members.find((m) => m.isYou)?.name).toBe('Bo');
  expect(onAda.events[0]).toMatchObject({ kind: 'damage', habitName: "Bo's run" });

  // Ada lands the last hit; each member is paid once, and it counts as a trophy.
  await setBossHp(onAda.boss!.id, 1);
  completeHabit(ada.phone.db, { userId: PLAYER, habitId: ada.quest, now: Date.now(), newId });
  await ada.phone.sync();
  const won = (await refresh(ada))!;
  expect(won.boss).toMatchObject({ currentHp: 0, defeated: true, claimed: false });
  const before = getCharacter(ada.phone.db, PLAYER)!.gold;
  for (const p of [ada, bo]) {
    expect(
      'state' in
        (await partyCall(p.account, { action: 'claim_reward', boss_week_id: won.boss!.id })),
    ).toBe(true);
    expect(
      await partyCall(p.account, { action: 'claim_reward', boss_week_id: won.boss!.id }),
    ).toEqual({
      error: 'already_claimed',
    });
    await p.phone.sync();
    expect(getCharacter(p.phone.db, PLAYER)?.bossesBeaten).toBe(1);
  }
  expect(getCharacter(ada.phone.db, PLAYER)!.gold).toBe(before + 50);
  expect((await refresh(ada))?.boss?.claimed).toBe(true);

  // Bo leaves: gone from Bo's phone, listed as a former fighter on Ada's.
  const left = await partyCall(bo.account, { action: 'leave' });
  if (!('state' in left)) throw new Error(left.error);
  saveParty(bo.phone.db, left.state, bo.account.id, Date.now());
  expect(getPartyView(bo.phone.db, Date.now())).toBeNull();
  expect((await refresh(ada))?.members.find((m) => m.name === 'Bo')?.active).toBe(false);
});

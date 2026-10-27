// The `party` function against the running stack (SCOPE.md section 9.2; D57): create, join,
// leave and the snapshot, the refusals, members-only answers and the rate limit.

import { assert, assertEquals, assertMatch } from '@std/assert';

import { partyStateSchema, type PartyState } from '../_shared/shared/index.ts';
import {
  API_URL,
  NO_STACK,
  callSync,
  database,
  deleteUser,
  newUser,
  profileChange,
  request,
  type TestUser,
} from './helpers.ts';

const test = (name: string, fn: () => Promise<void>) =>
  Deno.test({ name, fn, ignore: NO_STACK, sanitizeOps: false, sanitizeResources: false });

async function callParty(user: TestUser, body: unknown) {
  const res = await fetch(`${API_URL}/functions/v1/party`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
}

async function party(user: TestUser, body: unknown): Promise<NonNullable<PartyState['party']>> {
  const res = await callParty(user, body);
  assertEquals(res.status, 200, JSON.stringify(res.json));
  const state = partyStateSchema.parse(res.json);
  assert(state.party !== null);
  return state.party;
}

async function refused(user: TestUser, body: unknown, status: number) {
  const res = await callParty(user, body);
  assertEquals(res.status, status, JSON.stringify(res.json));
  return res.json.error as string;
}

/** Players with a hero each, deleted afterwards (which removes their rows). */
async function withHeroes(count: number, fn: (users: TestUser[]) => Promise<void>) {
  const users: TestUser[] = [];
  try {
    for (let i = 0; i < count; i++) {
      const user = await newUser();
      users.push(user);
      const res = await callSync(user.token, request(0, [profileChange(`Hero${i + 1}`)]));
      assertEquals(res.status, 200);
    }
    await fn(users);
  } finally {
    for (const user of users) await deleteUser(user);
  }
}

test('creating a party makes its code, its first boss and its first member', async () => {
  await withHeroes(1, async ([ada]) => {
    const made = await party(ada!, { action: 'create', name: '  Night   Owls ' });
    assertEquals(made.name, 'Night Owls');
    assertMatch(made.code, /^[A-HJ-NP-Z2-9]{6}$/);
    assertEquals(made.timezone, 'America/Toronto');
    assertEquals(made.members, [
      { user_id: ada!.id, hero_name: 'Hero1', class: 'mage', active: true, damage: 0 },
    ]);
    assertEquals(
      [made.boss?.boss_key, made.boss?.max_hp, made.boss?.current_hp],
      ['procrastination-slime', 500, 500],
    );
    assertEquals(
      made.events.map((e) => e.kind),
      ['join'],
    );
    assertEquals(made.claimed, false);
  });
});

test('a player needs a hero to start or join a party', async () => {
  const bare = await newUser();
  try {
    assertEquals(await refused(bare, { action: 'create', name: 'Owls' }, 409), 'no_hero');
  } finally {
    await deleteUser(bare);
  }
});

test('joining by code, in any case; then full, unknown and one party at a time', async () => {
  await withHeroes(6, async ([a, b, c, d, e, f]) => {
    const { code } = await party(a!, { action: 'create', name: 'Owls' });
    const joined = await party(b!, { action: 'join', code: code.toLowerCase() });
    assertEquals(joined.members.filter((m) => m.active).length, 2);
    // HP was fixed at the start of the week, for the one member there then (section 3).
    assertEquals(joined.boss?.max_hp, 500);
    await party(c!, { action: 'join', code });
    await party(d!, { action: 'join', code });
    assertEquals(await refused(e!, { action: 'join', code }, 409), 'party_full');
    assertEquals(await refused(e!, { action: 'join', code: 'ZZZZ22' }, 404), 'not_found');
    assertEquals(await refused(a!, { action: 'create', name: 'Again' }, 409), 'already_in_party');
    const other = await party(f!, { action: 'create', name: 'Larks' });
    assertEquals(await refused(b!, { action: 'join', code: other.code }, 409), 'already_in_party');
  });
});

test("leaving, coming back, and a leaver who hit this week's boss staying on the list", async () => {
  await withHeroes(2, async ([a, b]) => {
    const made = await party(a!, { action: 'create', name: 'Owls' });
    await party(b!, { action: 'join', code: made.code });

    const left = await callParty(b!, { action: 'leave' });
    assertEquals(left.json, { party: null });
    assertEquals(await refused(b!, { action: 'leave' }, 409), 'not_in_party');
    const seen = await party(a!, { action: 'state' });
    assertEquals(
      seen.members.map((m) => m.user_id),
      [a!.id],
    );
    assertEquals(
      seen.events.map((e) => e.kind),
      ['leave', 'join', 'join'],
    );

    const back = await party(b!, { action: 'join', code: made.code });
    assertEquals(back.members.filter((m) => m.active).length, 2);

    // B hits the boss for 30, then leaves: still listed this week, no longer active.
    const sql = database();
    try {
      await sql`
        insert into public.party_events (party_id, boss_week_id, user_id, kind, amount)
        values (${made.id}, ${made.boss!.id}, ${b!.id}, 'damage', 30)`;
    } finally {
      await sql.end();
    }
    await callParty(b!, { action: 'leave' });
    const after = await party(a!, { action: 'state' });
    assertEquals(after.members[0], {
      user_id: b!.id,
      hero_name: 'Hero2',
      class: 'mage',
      active: false,
      damage: 30,
    });
  });
});

test('only members see a party, and bad requests echo nothing back', async () => {
  await withHeroes(2, async ([a, outsider]) => {
    await party(a!, { action: 'create', name: 'Owls' });
    assertEquals((await callParty(outsider!, { action: 'state' })).json, { party: null });
    const bad = await callParty(outsider!, {
      action: 'create',
      name: '<script>x</script>'.repeat(3),
    });
    assertEquals(bad.status, 400);
    assert(!JSON.stringify(bad.json).includes('script'));
  });
});

test('ten party changes a minute, refused ones included; reading the snapshot is free', async () => {
  await withHeroes(1, async ([a]) => {
    for (let i = 0; i < 10; i++) {
      assertEquals(await refused(a!, { action: 'leave' }, 409), 'not_in_party');
    }
    assertEquals(await refused(a!, { action: 'leave' }, 429), 'rate_limited');
    assertEquals((await callParty(a!, { action: 'state' })).status, 200);
  });
});

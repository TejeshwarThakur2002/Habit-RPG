import { fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import type { PartyView as Party } from '@/db/queries/party';

import { PartyView, type PartyMode } from '../party-view';

const PARTY: Party = {
  id: 'p',
  name: 'Night Owls',
  code: 'K7M2QX',
  timezone: 'America/Toronto',
  fetchedAt: '2026-10-28T16:00:00.000Z',
  members: [
    { userId: 'r', name: 'Ravi', heroClass: 'mage', isYou: false, active: true, damage: 45 },
    { userId: 'local', name: 'Ada', heroClass: 'knight', isYou: true, active: true, damage: 20 },
    { userId: 'x', name: null, heroClass: null, isYou: false, active: true, damage: 5 },
    { userId: 'y', name: 'Gone', heroClass: 'rogue', isYou: false, active: false, damage: 9 },
  ],
  events: [
    {
      id: 'e1',
      kind: 'damage',
      bossWeekId: 'b',
      userId: 'r',
      amount: 45,
      habitName: 'Read',
      createdAt: '2026-10-28T15:58:00.000Z',
    },
  ],
  boss: {
    id: 'b',
    bossKey: 'procrastination-slime',
    weekStart: '2026-10-26',
    maxHp: 1500,
    currentHp: 1430,
    defeated: false,
    claimed: false,
    daysLeft: 1,
  },
};

// Two minutes after the snapshot was fetched.
const NOW = Date.parse('2026-10-28T16:02:00.000Z');

async function setup(mode: PartyMode, party: Party | null, refreshFailed = false) {
  const props = {
    onCreate: jest.fn(async () => null as string | null),
    onJoin: jest.fn(async () => null as string | null),
    onLeave: jest.fn(async () => null as string | null),
    onLinkAccount: jest.fn(),
  };
  await render(
    <PartyView mode={mode} party={party} refreshFailed={refreshFailed} now={NOW} {...props} />,
  );
  return props;
}

describe('PartyView', () => {
  it('asks a hero with no account to link one', async () => {
    const { onLinkAccount } = await setup('local', null);
    expect(screen.queryByText('Create a party')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Link an account' }));
    expect(onLinkAccount).toHaveBeenCalled();
  });

  it('creates a party and joins with a code in any case, checking each first', async () => {
    const { onCreate, onJoin } = await setup('account', null);
    await fireEvent.changeText(screen.getByLabelText('Party name'), 'Ow');
    await fireEvent.press(screen.getByRole('button', { name: 'Create party' }));
    expect(screen.getByText('Use 3 to 24 characters.')).toBeOnTheScreen();
    expect(onCreate).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByLabelText('Party name'), 'Owls');
    await fireEvent.press(screen.getByRole('button', { name: 'Create party' }));
    expect(onCreate).toHaveBeenCalledWith('Owls');

    await fireEvent.changeText(screen.getByLabelText('Invite code'), ' k7m2qx ');
    await fireEvent.press(screen.getByRole('button', { name: 'Join party' }));
    expect(onJoin).toHaveBeenCalledWith(' k7m2qx ');
  });

  it("shows the server's refusal under the field", async () => {
    const { onJoin } = await setup('account', null);
    onJoin.mockResolvedValue('That party is full: 4 members at most.');
    await fireEvent.changeText(screen.getByLabelText('Invite code'), 'K7M2QX');
    await fireEvent.press(screen.getByRole('button', { name: 'Join party' }));
    expect(await screen.findByText('That party is full: 4 members at most.')).toBeOnTheScreen();
  });

  it('lists active members by damage, marks you, and names a hero that is gone', async () => {
    await setup('account', PARTY);
    expect(screen.getByRole('header', { name: 'Night Owls' })).toBeOnTheScreen();
    expect(screen.getByText('1 day left')).toBeOnTheScreen();
    expect(screen.getByLabelText('Ada (you), 20 damage this week')).toBeOnTheScreen();
    expect(screen.getByLabelText('A former member, 5 damage this week')).toBeOnTheScreen();
    expect(screen.queryByText('Gone')).toBeNull();
    expect(screen.getByText('K7M2QX')).toBeOnTheScreen();
  });

  it('leaves only after the player confirms', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const { onLeave } = await setup('account', PARTY);
    await fireEvent.press(screen.getByRole('button', { name: 'Leave party' }));
    expect(onLeave).not.toHaveBeenCalled();
    const buttons = alert.mock.calls[0]?.[2] ?? [];
    await buttons.find((b) => b.text === 'Leave')?.onPress?.();
    expect(onLeave).toHaveBeenCalled();
    alert.mockRestore();
  });

  it('shows the demo party read-only', async () => {
    await setup('demo', PARTY);
    expect(screen.getByText('K7M2QX')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Leave party' })).toBeNull();
  });

  it("shows this week's boss, its HP and the battle log", async () => {
    await setup('account', PARTY);
    expect(screen.getByRole('header', { name: 'Procrastination Slime' })).toBeOnTheScreen();
    expect(screen.getByText('1,430 / 1,500 HP')).toBeOnTheScreen();
    expect(screen.getByText(/finished "Read" · 45 dmg · 4 min ago/)).toBeOnTheScreen();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('says when the stored party may be out of date, but never in the demo', async () => {
    await setup('account', PARTY, true);
    expect(screen.getByRole('alert')).toHaveTextContent('Showing last synced data (2 min ago)');
    await setup('demo', PARTY, true);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('invites the first hit when the log is empty', async () => {
    await setup('account', { ...PARTY, events: [] });
    expect(screen.getByText('No hits yet. Finish a quest to strike first.')).toBeOnTheScreen();
  });

  it("keeps each member's colour when the damage order changes", async () => {
    const avatar = () => screen.getByText('R').parent;
    await setup('account', PARTY);
    const before = avatar()?.props.style;
    const [ravi, ada, ...rest] = PARTY.members;
    await setup('account', { ...PARTY, members: [ada!, ravi!, ...rest] });
    expect(avatar()?.props.style).toEqual(before);
  });
});

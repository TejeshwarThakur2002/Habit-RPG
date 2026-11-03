import { fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import type { PartyView as Party } from '@/db/queries/party';

import { PartyView, type PartyMode } from '../party-view';

const PARTY: Party = {
  id: 'p',
  name: 'Night Owls',
  code: 'K7M2QX',
  fetchedAt: '2026-10-28T16:00:00.000Z',
  members: [
    { userId: 'r', name: 'Ravi', heroClass: 'mage', isYou: false, active: true, damage: 45 },
    { userId: 'local', name: 'Ada', heroClass: 'knight', isYou: true, active: true, damage: 20 },
    { userId: 'x', name: null, heroClass: null, isYou: false, active: true, damage: 5 },
    { userId: 'y', name: 'Gone', heroClass: 'rogue', isYou: false, active: false, damage: 9 },
  ],
  boss: {
    id: 'b',
    bossKey: 'procrastination-slime',
    maxHp: 1500,
    currentHp: 1430,
    defeated: false,
    claimed: false,
    daysLeft: 1,
  },
};

async function setup(mode: PartyMode, party: Party | null) {
  const props = {
    onCreate: jest.fn(async () => null as string | null),
    onJoin: jest.fn(async () => null as string | null),
    onLeave: jest.fn(async () => null as string | null),
    onLinkAccount: jest.fn(),
  };
  await render(<PartyView mode={mode} party={party} {...props} />);
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
});

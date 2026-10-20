import { fireEvent, render, screen } from '@testing-library/react-native';

import type { Habit } from '@/db/queries/hero';
import type { QuestBoard } from '@/db/queries/quest-board';

import { habitMeta, weekdayList } from '../habit-meta';
import { QuestBoardView } from '../quest-board-view';

const habit = (id: string, overrides: Partial<Habit> = {}): Habit => ({
  id,
  userId: 'local',
  name: id,
  type: 'daily',
  difficulty: 'medium',
  category: 'mind',
  weekdays: 127,
  reminderTime: null,
  sortOrder: 0,
  createdDate: '2026-10-01',
  archivedAt: null,
  deletedAt: null,
  clientUpdatedAt: '2026-10-01',
  serverSeq: null,
  ...overrides,
});

const board = (overrides: Partial<QuestBoard> = {}): QuestBoard => ({
  heroName: 'Sir Commit',
  heroClass: 'knight',
  level: 7,
  hp: 42,
  maxHp: 50,
  xpInLevel: 340,
  xpToNext: 500,
  gold: 128,
  streak: 12,
  equipped: [],
  today: [
    { habit: habit('Drink water', { difficulty: 'easy' }), rewardXp: 15, doneToday: true },
    { habit: habit('Code for 1 hour'), rewardXp: 33, doneToday: false },
  ],
  laterThisWeek: [],
  boss: { bossKey: 'procrastination-slime', hpPercent: 62 },
  ...overrides,
});

async function show(b: QuestBoard) {
  const onToggle = jest.fn();
  const onOpenParty = jest.fn();
  await render(<QuestBoardView board={b} onToggle={onToggle} onOpenParty={onOpenParty} />);
  return { onToggle, onOpenParty };
}

describe('QuestBoardView', () => {
  it('shows the hero, bars and progress like the design', async () => {
    await show(board());
    expect(screen.getByRole('header', { name: 'Quest Board' })).toBeOnTheScreen();
    expect(screen.getByText('Lv 7')).toBeOnTheScreen();
    expect(screen.getByText('42 / 50')).toBeOnTheScreen();
    expect(screen.getByText('340 / 500')).toBeOnTheScreen();
    expect(screen.getByText('12-day streak')).toBeOnTheScreen();
    expect(screen.getByText('1 of 2 done')).toBeOnTheScreen();
    expect(screen.getByText('Saved on this phone')).toBeOnTheScreen();
  });

  it('toggles a quest, passing whether it was done', async () => {
    const { onToggle } = await show(board());
    await fireEvent.press(screen.getByRole('checkbox', { name: /^Code for 1 hour/ }));
    expect(onToggle).toHaveBeenCalledWith('Code for 1 hour', false);
    await fireEvent.press(screen.getByRole('checkbox', { name: /^Drink water/ }));
    expect(onToggle).toHaveBeenCalledWith('Drink water', true);
  });

  it('shows the real reward on an open quest', async () => {
    await show(board());
    expect(screen.getByText('+33 XP')).toBeOnTheScreen();
  });

  it('celebrates when every quest is done', async () => {
    await show(board({ today: [{ habit: habit('Read'), rewardXp: 20, doneToday: true }] }));
    expect(screen.getByText('All quests done! See you tomorrow.')).toBeOnTheScreen();
  });

  it('shows a friendly empty state for a new hero', async () => {
    await show(board({ today: [], boss: null }));
    expect(screen.getByText('No quests yet')).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: 'Start or join a party' })).toBeOnTheScreen();
  });

  it('opens the Party tab from the boss card', async () => {
    const { onOpenParty } = await show(board());
    await fireEvent.press(screen.getByRole('link', { name: /Procrastination Slime, 62% health/ }));
    expect(onOpenParty).toHaveBeenCalled();
  });

  it('keeps unscheduled quests in a collapsed "later this week" group', async () => {
    await show(board({ laterThisWeek: [habit('Swim', { type: 'weekdays', weekdays: 1 | 16 })] }));
    expect(screen.queryByText('Swim')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Later this week, 1 quests' }));
    expect(screen.getByText('Swim')).toBeOnTheScreen();
    expect(screen.getByText('Mon, Fri · Medium')).toBeOnTheScreen();
  });
});

describe('habitMeta', () => {
  it('describes each habit type', () => {
    expect(habitMeta(habit('a', { difficulty: 'easy' }))).toBe('Daily · Easy');
    expect(habitMeta(habit('b', { type: 'bad' }))).toBe('Bad habit · lose 8 HP if broken');
    expect(weekdayList(127)).toBe('Mon, Tue, Wed, Thu, Fri, Sat, Sun');
  });
});

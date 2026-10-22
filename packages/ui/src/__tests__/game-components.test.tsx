import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { DragHandle, HabitRow, habitRowLabel } from '../components/habit-row';
import { Heatmap, heatLevel } from '../components/heatmap';
import { BattleLogLine, BossCard, MemberRow, formatNumber } from '../components/party';
import { ShopItem } from '../components/shop-item';

describe('HabitRow', () => {
  const props = { name: 'Code for 1 hour', meta: 'Daily · Medium', rewardXp: 20 };

  it('reads like the accessibility checklist example', () => {
    expect(habitRowLabel({ ...props, done: false })).toBe(
      'Code for 1 hour, daily, medium, plus 20 XP, not done',
    );
  });

  it('is a checkbox that toggles, with its checked state exposed', async () => {
    const onToggle = jest.fn();
    await render(<HabitRow {...props} done={false} onToggle={onToggle} />);
    const row = screen.getByRole('checkbox');
    expect(row).not.toBeChecked();
    expect(screen.getByText('+20 XP')).toBeOnTheScreen();
    await fireEvent.press(row);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('shows the done state in words, not only colour', async () => {
    await render(<HabitRow {...props} done onToggle={jest.fn()} />);
    expect(screen.getByRole('checkbox')).toBeChecked();
    expect(screen.getByText('Done')).toBeOnTheScreen();
  });

  it('opens the editor on long press and through the screen reader Edit action', async () => {
    const onEdit = jest.fn();
    const onToggle = jest.fn();
    await render(<HabitRow {...props} bad done={false} onToggle={onToggle} onEdit={onEdit} />);
    const row = screen.getByRole('checkbox');
    await fireEvent(row, 'longPress');
    await fireEvent(row, 'accessibilityAction', { nativeEvent: { actionName: 'edit' } });
    await fireEvent(row, 'accessibilityAction', { nativeEvent: { actionName: 'activate' } });
    expect(onEdit).toHaveBeenCalledTimes(2);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('offers Move up and Move down to screen readers, and shows a drag handle', async () => {
    const onMoveUp = jest.fn();
    const onMoveDown = jest.fn();
    const onDrag = jest.fn();
    await render(
      <HabitRow
        {...props}
        done={false}
        onToggle={jest.fn()}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        dragHandle={<DragHandle onPressIn={onDrag} />}
      />,
    );
    const row = screen.getByRole('checkbox');
    expect(row.props.accessibilityActions.map((a: { name: string }) => a.name)).toEqual([
      'activate',
      'moveUp',
      'moveDown',
    ]);
    await fireEvent(row, 'accessibilityAction', { nativeEvent: { actionName: 'moveUp' } });
    await fireEvent(row, 'accessibilityAction', { nativeEvent: { actionName: 'moveDown' } });
    expect(onMoveUp).toHaveBeenCalledTimes(1);
    expect(onMoveDown).toHaveBeenCalledTimes(1);

    await fireEvent(
      screen.getByLabelText('Drag to reorder', { includeHiddenElements: true }),
      'pressIn',
    );
    expect(onDrag).toHaveBeenCalledTimes(1);
  });
});

describe('ShopItem', () => {
  const base = {
    name: 'Oak Shield',
    effect: '+2 CON · blocks 1 missed daily',
    price: 40,
    icon: null,
  };

  it('buys a buyable item', async () => {
    const onPress = jest.fn();
    await render(<ShopItem {...base} state={{ kind: 'buyable' }} onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Buy Oak Shield for 40 gold' }));
    expect(onPress).toHaveBeenCalled();
  });

  it('disables a too-expensive item and says how much more gold is needed', async () => {
    await render(<ShopItem {...base} state={{ kind: 'expensive', goldNeeded: 12 }} />);
    expect(screen.getByRole('button')).toBeDisabled();
    expect(
      screen.getByText('+2 CON · blocks 1 missed daily · Need 12 more gold'),
    ).toBeOnTheScreen();
  });

  it('disables a locked item and shows its unlock level', async () => {
    await render(
      <ShopItem
        {...base}
        name="Dragon Cape"
        price={200}
        state={{ kind: 'locked', unlockLevel: 10 }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Dragon Cape, unlocks at level 10' })).toBeDisabled();
    expect(screen.getByText('Unlocks at level 10')).toBeOnTheScreen();
  });

  it('offers Equip when owned and Equipped when worn', async () => {
    await render(
      <>
        <ShopItem {...base} state={{ kind: 'owned' }} />
        <ShopItem {...base} name="Wizard Hat" state={{ kind: 'equipped' }} />
      </>,
    );
    expect(screen.getByRole('button', { name: 'Equip Oak Shield' })).toBeEnabled();
    expect(screen.getByText('Equipped')).toBeOnTheScreen();
  });
});

describe('Heatmap', () => {
  it('maps counts to levels 0, 1, 2, 3-4 and 5+', () => {
    expect([0, 1, 2, 3, 4, 5, 9].map(heatLevel)).toEqual([0, 1, 2, 3, 3, 4, 4]);
  });

  it('is one image with a text summary for screen readers', async () => {
    await render(<Heatmap counts={[1, 2, 3]} summary="Active on 3 of the last 84 days" />);
    expect(
      screen.getByRole('image', { name: 'Active on 3 of the last 84 days' }),
    ).toBeOnTheScreen();
    // The legend is visual only; the summary already tells screen-reader users the story.
    expect(screen.getByText('Less', { includeHiddenElements: true })).toBeOnTheScreen();
  });
});

describe('Party components', () => {
  it('formats numbers with thousands separators', () => {
    expect(formatNumber(1240)).toBe('1,240');
    expect(formatNumber(2000000)).toBe('2,000,000');
    expect(formatNumber(34)).toBe('34');
  });

  it('shows boss HP as numbers and a labelled progress bar', async () => {
    await render(
      <BossCard name="Procrastination Slime" hp={1240} maxHp={2000} sprite={<Text>sprite</Text>} />,
    );
    expect(screen.getByText('Weekly boss')).toBeOnTheScreen();
    expect(screen.getByText('1,240 / 2,000 HP')).toBeOnTheScreen();
    expect(
      screen.getByRole('progressbar', { name: 'Procrastination Slime health' }),
    ).toHaveAccessibilityValue({
      text: '1,240 / 2,000 HP',
    });
  });

  it('marks a defeated boss in words', async () => {
    await render(<BossCard name="Snooze Goblin" hp={0} maxHp={0} sprite={null} defeated />);
    expect(screen.getByText('Defeated!')).toBeOnTheScreen();
  });

  it('labels the member row and marks you', async () => {
    await render(<MemberRow name="Sir Commit" damage={240} avatarColor="purple" isYou />);
    expect(screen.getByLabelText('Sir Commit (you), 240 damage this week')).toBeOnTheScreen();
    expect(screen.getByText('SC')).toBeOnTheScreen();
  });

  it('renders a battle log line with highlighted names', async () => {
    await render(
      <BattleLogLine
        parts={[{ text: 'The Slime', tone: 'boss' }, ' hit Bard Jay for 8 · missed workout']}
      />,
    );
    expect(screen.getByText('The Slime')).toBeOnTheScreen();
  });
});

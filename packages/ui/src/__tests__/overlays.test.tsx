import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { SegmentedControl, TextField } from '../components/inputs';
import { BottomSheet, Modal, TOAST_DURATION_MS, Toast } from '../components/overlays';

describe('TextField', () => {
  it('is labelled, shows a character count and reports changes', async () => {
    const onChangeText = jest.fn();
    await render(
      <TextField label="Hero name" value="Sir" maxLength={20} onChangeText={onChangeText} />,
    );
    const input = screen.getByLabelText('Hero name');
    await fireEvent.changeText(input, 'Sir Commit');
    expect(onChangeText).toHaveBeenCalledWith('Sir Commit');
    expect(screen.getByText('3 / 20')).toBeOnTheScreen();
  });

  it('shows an error in place of the hint', async () => {
    await render(
      <TextField label="Name" value="" hint="2 to 20 characters" error="Name is required" />,
    );
    expect(screen.getByText('Name is required')).toBeOnTheScreen();
    expect(screen.queryByText('2 to 20 characters')).toBeNull();
  });

  it('passes focus and blur through to the caller', async () => {
    const onFocus = jest.fn();
    const onBlur = jest.fn();
    await render(<TextField label="Code" value="" onFocus={onFocus} onBlur={onBlur} />);
    const input = screen.getByLabelText('Code');
    await fireEvent(input, 'focus');
    await fireEvent(input, 'blur');
    expect(onFocus).toHaveBeenCalled();
    expect(onBlur).toHaveBeenCalled();
  });
});

describe('SegmentedControl', () => {
  const options = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekdays', label: 'Weekdays' },
    { value: 'bad', label: "Don't" },
  ] as const;

  it('marks the selected segment and reports a new choice', async () => {
    const onChange = jest.fn();
    await render(
      <SegmentedControl label="Habit type" options={options} value="daily" onChange={onChange} />,
    );
    expect(screen.getByRole('tab', { name: 'Daily' })).toBeSelected();
    expect(screen.getByRole('tab', { name: "Don't" })).not.toBeSelected();
    await fireEvent.press(screen.getByRole('tab', { name: 'Weekdays' }));
    expect(onChange).toHaveBeenCalledWith('weekdays');
  });
});

describe('Modal and BottomSheet', () => {
  it('shows the modal title and content only while visible', async () => {
    const { rerender } = await render(
      <Modal visible title="Level 8!" onClose={jest.fn()}>
        <Text>HP restored, +25 gold</Text>
      </Modal>,
    );
    expect(screen.getByRole('header', { name: 'Level 8!' })).toBeOnTheScreen();
    await rerender(
      <Modal visible={false} title="Level 8!" onClose={jest.fn()}>
        <Text>HP restored, +25 gold</Text>
      </Modal>,
    );
    expect(screen.queryByText('HP restored, +25 gold')).toBeNull();
  });

  it('closes the sheet when the backdrop is tapped', async () => {
    const onClose = jest.fn();
    await render(
      <BottomSheet visible title="New quest" onClose={onClose}>
        <Text>form</Text>
      </BottomSheet>,
    );
    expect(screen.getByText('New quest')).toBeOnTheScreen();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Close', includeHiddenElements: true }),
    );
    await fireEvent(screen.getByTestId('bottom-sheet'), 'accessibilityEscape');
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe('Toast', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('offers Undo and dismisses itself after 5 seconds', async () => {
    const onDismiss = jest.fn();
    const onUndo = jest.fn();
    await render(
      <Toast
        message="Bought Oak Shield"
        action={{ label: 'Undo', onPress: onUndo }}
        onDismiss={onDismiss}
      />,
    );
    expect(screen.getByRole('alert')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Undo' }));
    expect(onUndo).toHaveBeenCalled();
    await act(() => jest.advanceTimersByTime(TOAST_DURATION_MS - 1));
    expect(onDismiss).not.toHaveBeenCalled();
    await act(() => jest.advanceTimersByTime(1));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('stays up when no dismiss handler is given', async () => {
    await render(<Toast message="That purchase failed: not enough gold" tone="error" />);
    await act(() => jest.advanceTimersByTime(TOAST_DURATION_MS * 2));
    expect(screen.getByText('That purchase failed: not enough gold')).toBeOnTheScreen();
  });
});

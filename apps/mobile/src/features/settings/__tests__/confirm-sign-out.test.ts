import { Alert, type AlertButton } from 'react-native';

import { confirmSignOut } from '../confirm-sign-out';

const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

function lastAlert() {
  const [title, message, buttons] = alert.mock.lastCall ?? [];
  return { title, message, buttons: (buttons ?? []) as AlertButton[] };
}

describe('confirmSignOut', () => {
  it('names what a local hero loses and signs out only on confirm', () => {
    const onConfirm = jest.fn();
    confirmSignOut('local', 'Sir Commit', onConfirm);
    const { title, message, buttons } = lastAlert();

    expect(title).toBe('Sign out?');
    expect(message).toContain('This deletes Sir Commit, your quests and your gold');
    expect(buttons.map((b) => b.text)).toEqual(['Cancel', 'Sign out']);
    expect(onConfirm).not.toHaveBeenCalled();

    buttons[1]?.onPress?.();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('asks before leaving the demo', () => {
    confirmSignOut('demo', 'Sir Commit', jest.fn());
    const { title, buttons } = lastAlert();
    expect(title).toBe('Leave the demo?');
    expect(buttons[1]).toMatchObject({ text: 'Leave', style: 'destructive' });
  });
});

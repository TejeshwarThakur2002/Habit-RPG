import { Alert, type AlertButton } from 'react-native';

import { confirmKeepPhone, confirmUseAccount, heroNames } from '../confirm-hero-choice';

const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

function lastAlert() {
  const [title, message, buttons] = alert.mock.lastCall ?? [];
  return { title, message, buttons: (buttons ?? []) as AlertButton[] };
}

const names = { account: 'Bea', phone: 'Ada' };

describe('confirmUseAccount', () => {
  it('says the phone loses its hero, and goes ahead only on confirm', () => {
    const onConfirm = jest.fn();
    confirmUseAccount(names, onConfirm);
    const { title, message, buttons } = lastAlert();
    expect(title).toBe('Use Bea?');
    expect(message).toBe(
      "Ada, with its quests, history and gold, will be deleted from this phone, and Bea downloaded. This can't be undone.",
    );
    expect(buttons[1]).toMatchObject({ text: 'Use Bea', style: 'destructive' });
    expect(onConfirm).not.toHaveBeenCalled();
    buttons[1]?.onPress?.();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

describe('confirmKeepPhone', () => {
  it('says the account loses its hero on every phone', () => {
    confirmKeepPhone(names, jest.fn());
    const { title, message, buttons } = lastAlert();
    expect(title).toBe('Keep Ada?');
    expect(message).toContain('Bea, with its quests, history and gold, will be deleted from your');
    expect(message).toContain('account on every phone');
    expect(buttons[0]).toMatchObject({ text: 'Cancel', style: 'cancel' });
    expect(buttons[1]).toMatchObject({ text: 'Replace Bea', style: 'destructive' });
  });

  it('starts the sentence with a capital when a name is unknown', () => {
    confirmKeepPhone(heroNames(null, null), jest.fn());
    expect(lastAlert().message).toMatch(/^Your account's hero, with its quests/);
  });
});

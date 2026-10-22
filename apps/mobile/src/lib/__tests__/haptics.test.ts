import * as Haptics from 'expo-haptics';

import { haptics } from '../haptics';

describe('haptics', () => {
  it('asks for the feedback SCOPE.md section 5.9 lists for each moment', () => {
    haptics.complete();
    haptics.levelUp();
    haptics.faint();
    haptics.tabChange();
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(
      Haptics.NotificationFeedbackType.Success,
    );
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(
      Haptics.NotificationFeedbackType.Warning,
    );
    expect(Haptics.selectionAsync).toHaveBeenCalled();
  });

  it('logs a refused haptic instead of throwing', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.mocked(Haptics.selectionAsync).mockRejectedValueOnce(new Error('Low Power Mode'));
    expect(() => haptics.tabChange()).not.toThrow();
    await new Promise((resolve) => setImmediate(resolve));
    expect(warn).toHaveBeenCalledWith('Haptic feedback failed', expect.any(Error));
    warn.mockRestore();
  });
});

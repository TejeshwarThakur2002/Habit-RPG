import * as Clipboard from 'expo-clipboard';
import { Share } from 'react-native';

import { copyCode, inviteMessage, shareCode } from '../invite';

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(() => Promise.resolve(true)) }));

describe('invite', () => {
  it('copies just the code, and shares it with a line to go with it', async () => {
    const share = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: 'sharedAction', activityType: undefined });
    await copyCode('K7M2QX');
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith('K7M2QX');
    await shareCode('K7M2QX');
    expect(share).toHaveBeenCalledWith({ message: inviteMessage('K7M2QX') });
    expect(inviteMessage('K7M2QX')).toBe('Join my party in Habit RPG with the code K7M2QX');
  });
});

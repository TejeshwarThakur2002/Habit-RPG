import { Alert } from 'react-native';

import type { AccountMode } from './settings-view';

/**
 * Signing out wipes the hero from the phone (there is no account to keep it until P3), so it
 * always asks first and says exactly what goes.
 */
export function confirmSignOut(mode: AccountMode, heroName: string, onConfirm: () => void): void {
  const [title, message, action] =
    mode === 'demo'
      ? ['Leave the demo?', 'The sample hero and quests will be cleared.', 'Leave']
      : [
          'Sign out?',
          `This deletes ${heroName}, your quests and your gold from this phone. It can't be undone.`,
          'Sign out',
        ];
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: action, style: 'destructive', onPress: onConfirm },
  ]);
}

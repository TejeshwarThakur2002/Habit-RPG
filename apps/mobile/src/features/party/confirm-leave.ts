import { Alert } from 'react-native';

/** Leaving is a server action that can't be undone from here, so it always asks first. */
export function confirmLeave(partyName: string, onConfirm: () => void): void {
  Alert.alert(
    'Leave the party?',
    `You'll stop fighting alongside ${partyName}. You can join again with the invite code.`,
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: onConfirm },
    ],
  );
}

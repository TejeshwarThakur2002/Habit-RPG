import type { AccountHero } from '@habit-rpg/shared';
import { Alert } from 'react-native';

export interface HeroNames {
  account: string;
  phone: string;
}

/** The heroes' names, or a description when one isn't known. */
export function heroNames(account: AccountHero | null, phone: AccountHero | null): HeroNames {
  return {
    account: account?.hero_name ?? "your account's hero",
    phone: phone?.hero_name ?? "this phone's hero",
  };
}

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * Each choice deletes one hero for good, so it asks first and says which, and where from
 * (D48). Like signing out, the action is marked destructive.
 */
export function confirmUseAccount({ account, phone }: HeroNames, onConfirm: () => void): void {
  Alert.alert(
    `Use ${account}?`,
    `${capital(phone)}, with its quests, history and gold, will be deleted from this phone, and ${account} downloaded. This can't be undone.`,
    [
      { text: 'Cancel', style: 'cancel' },
      { text: `Use ${account}`, style: 'destructive', onPress: onConfirm },
    ],
  );
}

export function confirmKeepPhone({ account, phone }: HeroNames, onConfirm: () => void): void {
  Alert.alert(
    `Keep ${phone}?`,
    `${capital(account)}, with its quests, history and gold, will be deleted from your account on every phone, and ${phone} uploaded in its place. This can't be undone.`,
    [
      { text: 'Cancel', style: 'cancel' },
      { text: `Replace ${account}`, style: 'destructive', onPress: onConfirm },
    ],
  );
}

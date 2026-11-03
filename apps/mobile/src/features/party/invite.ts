// The invite card's Copy and Share (SCOPE.md section 5.5, item 5; D62). There are no deep links
// yet, so the code itself is what friends type into "Join with a code".

import * as Clipboard from 'expo-clipboard';
import { Share } from 'react-native';

export function inviteMessage(code: string): string {
  return `Join my party in Habit RPG with the code ${code}`;
}

export async function copyCode(code: string): Promise<void> {
  await Clipboard.setStringAsync(code);
}

/** Opens the share sheet; the player may close it without sharing, which is fine. */
export async function shareCode(code: string): Promise<void> {
  await Share.share({ message: inviteMessage(code) });
}

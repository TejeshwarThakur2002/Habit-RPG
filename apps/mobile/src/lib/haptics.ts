import * as Haptics from 'expo-haptics';

// SCOPE.md section 5.9. Haptics stay on with Reduce Motion. The phone may refuse one (Low
// Power Mode, no Taptic Engine); that must never undo or block the action that caused it,
// so the failure is logged rather than thrown.
function fire(haptic: Promise<void>): void {
  haptic.catch((error: unknown) => console.warn('Haptic feedback failed', error));
}

export const haptics = {
  complete: () => fire(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  levelUp: () => fire(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  faint: () => fire(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  tabChange: () => fire(Haptics.selectionAsync()),
};

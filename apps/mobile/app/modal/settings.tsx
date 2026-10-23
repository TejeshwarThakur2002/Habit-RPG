import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Linking } from 'react-native';

import { db } from '@/db/client';
import { getProfile, updateProfile } from '@/db/queries/hero';
import { resetLocalData } from '@/db/queries/local-data';
import { getSettings, updateSettings } from '@/db/queries/settings';
import { LOCAL_USER_ID } from '@/db/types';
import { useDbQuery } from '@/db/use-db-query';
import { useNotificationAccess } from '@/features/reminders/use-notification-access';
import { confirmSignOut } from '@/features/settings/confirm-sign-out';
import { SettingsView } from '@/features/settings/settings-view';
import { deviceTimeZone } from '@/lib/device';

function readSettingsScreen() {
  const profile = getProfile(db, LOCAL_USER_ID);
  if (!profile) return null;
  const { demoMode, reduceMotion, notificationHintSeen } = getSettings(db);
  const mode = demoMode ? ('demo' as const) : ('local' as const);
  return { profile, reduceMotion, mode, notificationHintSeen };
}

/** `modal/settings` (SCOPE.md section 5.3), opened from the gear on Stats. */
export default function Settings() {
  const data = useDbQuery(readSettingsScreen);
  const { access, ask } = useNotificationAccess();
  // Gone for a moment after signing out, while the route guard moves to sign-in.
  if (!data) return null;
  const { profile, reduceMotion, mode, notificationHintSeen } = data;
  return (
    <SettingsView
      hero={{ heroName: profile.heroName, timezone: profile.timezone }}
      deviceTimeZone={deviceTimeZone()}
      reduceMotion={reduceMotion}
      mode={mode}
      version={Constants.expoConfig?.version ?? 'unknown'}
      notifications={{
        access,
        hintSeen: notificationHintSeen,
        onTurnOn: ask,
        onOpenPhoneSettings: () => {
          Linking.openSettings().catch((error: unknown) =>
            console.warn('Opening phone Settings failed', error),
          );
        },
        onDismissHint: () => updateSettings(db, { notificationHintSeen: true }),
      }}
      onSaveHero={(fields) => updateProfile(db, LOCAL_USER_ID, fields)}
      onReduceMotion={(value) => updateSettings(db, { reduceMotion: value })}
      onSignOut={() => confirmSignOut(mode, profile.heroName, () => resetLocalData(db))}
      onClose={() => router.back()}
    />
  );
}

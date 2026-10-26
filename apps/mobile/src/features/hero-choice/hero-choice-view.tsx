import type { AccountHero } from '@habit-rpg/shared';
import { Button, colors, radii, spacing, type } from '@habit-rpg/ui';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { KeyboardScreen } from '@/components/keyboard-screen';
import { CLASS_TITLES } from '@/features/hero/hero-sheet-card';

import { confirmKeepPhone, confirmUseAccount, heroNames } from './confirm-hero-choice';

export interface HeroChoiceViewProps {
  /** Null when the server didn't say which hero the account has. */
  accountHero: AccountHero | null;
  phoneHero: AccountHero | null;
  /** Each resolves with an error message, or null once the choice is done. */
  onUseAccount: () => Promise<string | null>;
  onKeepPhone: () => Promise<string | null>;
  onLater: () => void;
}

function HeroRow({ place, hero }: { place: string; hero: AccountHero | null }) {
  const detail = hero ? `Level ${hero.level} ${CLASS_TITLES[hero.class]}` : null;
  return (
    <View
      accessible
      accessibilityLabel={[place, hero?.hero_name ?? 'a hero', detail].filter(Boolean).join(', ')}
      style={styles.hero}
    >
      <Text style={type.label}>{place}</Text>
      <Text style={type.bodyStrong}>{hero?.hero_name ?? 'A hero'}</Text>
      {detail && <Text style={type.secondary}>{detail}</Text>}
    </View>
  );
}

/**
 * The two-heroes choice (D48, D49): the account already has a hero from another phone and this
 * phone has its own, and only one can stay. Each choice asks first; "Not now" leaves the phone
 * unsynced until the next first sync asks again.
 */
export function HeroChoiceView({
  accountHero,
  phoneHero,
  onUseAccount,
  onKeepPhone,
  onLater,
}: HeroChoiceViewProps) {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const names = heroNames(accountHero, phoneHero);

  const run = async (choice: () => Promise<string | null>) => {
    setBusy(true);
    setFailure(null);
    const error = await choice();
    setBusy(false);
    setFailure(error);
  };

  return (
    <KeyboardScreen top={24}>
      <View style={styles.body}>
        <Text accessibilityRole="header" style={type.screenTitle}>
          Keep which hero?
        </Text>
        <Text style={type.secondary}>
          Your account already has a hero from another phone. Only one of them can stay.
        </Text>
        <HeroRow place="On your account" hero={accountHero} />
        <HeroRow place="On this phone" hero={phoneHero} />
        {busy && (
          <Text accessibilityLiveRegion="polite" style={type.secondary}>
            Syncing…
          </Text>
        )}
        {failure && (
          <Text accessibilityRole="alert" style={[type.body, styles.failure]}>
            {failure}
          </Text>
        )}
      </View>
      <View style={styles.actions}>
        <Button
          label="Use my account's hero"
          disabled={busy}
          onPress={() => confirmUseAccount(names, () => void run(onUseAccount))}
        />
        <Button
          label="Keep this phone's hero"
          variant="secondary"
          disabled={busy}
          onPress={() => confirmKeepPhone(names, () => void run(onKeepPhone))}
        />
        <Button label="Not now" variant="ghost" disabled={busy} onPress={onLater} />
      </View>
    </KeyboardScreen>
  );
}

const styles = StyleSheet.create({
  body: { gap: 12 },
  actions: { gap: 10 },
  hero: {
    gap: 2,
    padding: spacing.row + 4,
    borderRadius: radii.row,
    backgroundColor: colors.surface,
  },
  failure: { color: colors.red },
});

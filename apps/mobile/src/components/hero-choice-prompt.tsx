import { router } from 'expo-router';
import { useEffect, useSyncExternalStore } from 'react';

import { currentHeroChoice, subscribeHeroChoice } from '@/sync/hero-choice';

/**
 * Opens the two-heroes choice when a first sync asks for it (D49). A React Native Modal can't
 * open over a native modal screen such as Settings, so the choice is a modal route instead.
 */
export function HeroChoicePrompt() {
  const choice = useSyncExternalStore(subscribeHeroChoice, currentHeroChoice);
  useEffect(() => {
    if (choice !== null) router.push('/modal/hero-choice');
  }, [choice]);
  return null;
}

import type { AccountHero } from '@habit-rpg/shared';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';

import { db } from '@/db/client';
import { getCharacter, getProfile } from '@/db/queries/hero';
import { LOCAL_USER_ID } from '@/db/types';
import { HeroChoiceView } from '@/features/hero-choice/hero-choice-view';
import type { FirstSyncOutcome } from '@/sync/first-sync';
import { firstSyncNow, takeAccountHeroNow } from '@/sync/first-sync-runner';
import { closeHeroChoice, currentHeroChoice } from '@/sync/hero-choice';

function phoneHero(): AccountHero | null {
  const profile = getProfile(db, LOCAL_USER_ID);
  if (!profile) return null;
  const level = getCharacter(db, LOCAL_USER_ID)?.level ?? 1;
  return { hero_name: profile.heroName, class: profile.heroClass, level };
}

/** What went wrong, or null when the choice is done. */
function failureOf(outcome: FirstSyncOutcome): string | null {
  if (outcome.status === 'done') return null;
  if (outcome.status === 'offline') return "Can't reach the server. Try again when you're online.";
  if (outcome.status === 'conflict') return 'Your account changed in the meantime. Try again.';
  return outcome.message;
}

/**
 * `modal/hero-choice`, opened by HeroChoicePrompt when the first sync finds that the account
 * already has a different hero (D49). A route rather than an overlay, so it can open over
 * Settings, where linking an account leaves the player.
 */
export default function HeroChoice() {
  const choice = currentHeroChoice();
  const open = useRef(true);
  // However the screen closes, the choice is put off until the next first sync.
  useEffect(
    () => () => {
      open.current = false;
      closeHeroChoice();
    },
    [],
  );

  const finish = (outcome: FirstSyncOutcome): string | null => {
    const failure = failureOf(outcome);
    if (failure === null && open.current) router.back();
    return failure;
  };

  if (choice === null) return null;
  const { accountUserId, accountHero } = choice;
  return (
    <HeroChoiceView
      accountHero={accountHero}
      phoneHero={phoneHero()}
      onUseAccount={async () => finish(await takeAccountHeroNow(accountUserId))}
      onKeepPhone={async () => finish(await firstSyncNow(accountUserId, { replace: true }))}
      onLater={() => router.back()}
    />
  );
}

import { addDatabaseChangeListener } from 'expo-sqlite';
import { useEffect, useState } from 'react';

import { db } from '@/db/client';
import { getProfile } from '@/db/queries/hero';
import { getSettings } from '@/db/queries/settings';
import { LOCAL_USER_ID, type AppDb } from '@/db/types';

import { decideArea, type AppArea } from './route';

export function readArea(database: AppDb): AppArea {
  const current = getSettings(database);
  return decideArea({
    signedIn: false,
    demoMode: current.demoMode,
    onboardingDone: current.onboardingDone,
    hasProfile: getProfile(database, LOCAL_USER_ID) !== undefined,
  });
}

/**
 * The current app area. It is read synchronously on the first render, so the router never
 * mounts the wrong group and switches a frame later (DECISIONS.md D18), then re-read after
 * every database change.
 */
export function useAppArea(): AppArea {
  const [area, setArea] = useState(() => readArea(db));
  useEffect(() => {
    const subscription = addDatabaseChangeListener(() => setArea(readArea(db)));
    return () => subscription.remove();
  }, []);
  return area;
}

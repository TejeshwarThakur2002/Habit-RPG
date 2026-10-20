// Which part of the app the user may see (SCOPE.md section 5.3, route guards).

export type AppArea = 'sign-in' | 'onboarding' | 'tabs';

export interface SessionState {
  /** A Supabase session exists (P3); always false until sign-in is built. */
  signedIn: boolean;
  demoMode: boolean;
  /** Chose "Start without an account" on sign-in (DECISIONS.md D19). */
  localOnly: boolean;
  onboardingDone: boolean;
  hasProfile: boolean;
}

/**
 * No session, no demo and no local play: sign in. In, but without a hero: onboarding.
 * Otherwise the tabs.
 */
export function decideArea(state: SessionState): AppArea {
  if (!state.signedIn && !state.demoMode && !state.localOnly) return 'sign-in';
  if (!state.hasProfile || !state.onboardingDone) return 'onboarding';
  return 'tabs';
}

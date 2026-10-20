// Which part of the app the user may see (SCOPE.md section 5.3, route guards).

export type AppArea = 'sign-in' | 'onboarding' | 'tabs';

export interface SessionState {
  /** A Supabase session exists (P3); always false until sign-in is built. */
  signedIn: boolean;
  demoMode: boolean;
  onboardingDone: boolean;
  hasProfile: boolean;
}

/** No session and no demo: sign in. Signed in without a hero: onboarding. Otherwise the tabs. */
export function decideArea(state: SessionState): AppArea {
  if (!state.signedIn && !state.demoMode) return 'sign-in';
  if (!state.hasProfile || !state.onboardingDone) return 'onboarding';
  return 'tabs';
}

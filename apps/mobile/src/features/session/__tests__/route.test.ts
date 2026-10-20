import { decideArea, type SessionState } from '../route';

const base: SessionState = {
  signedIn: false,
  demoMode: false,
  onboardingDone: false,
  hasProfile: false,
};

describe('decideArea', () => {
  it('sends a new install to sign-in', () => {
    expect(decideArea(base)).toBe('sign-in');
  });

  it('lets a finished demo into the tabs', () => {
    expect(decideArea({ ...base, demoMode: true, onboardingDone: true, hasProfile: true })).toBe(
      'tabs',
    );
  });

  it('sends a signed-in user without a hero to onboarding', () => {
    expect(decideArea({ ...base, signedIn: true })).toBe('onboarding');
    expect(decideArea({ ...base, signedIn: true, hasProfile: true })).toBe('onboarding');
  });

  it('lets a signed-in user with a hero into the tabs', () => {
    expect(decideArea({ ...base, signedIn: true, hasProfile: true, onboardingDone: true })).toBe(
      'tabs',
    );
  });
});

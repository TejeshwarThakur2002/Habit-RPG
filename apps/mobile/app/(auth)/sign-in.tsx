import { db } from '@/db/client';
import { updateSettings } from '@/db/queries/settings';
import { seedDemo } from '@/db/seed-demo';
import { SignInView } from '@/features/auth/sign-in-view';
import { deviceTimeZone, newId } from '@/lib/device';

export default function SignIn() {
  // Seeding flips settings.demoMode, and the route guard then moves the user to the tabs.
  const tryDemo = () => seedDemo(db, { now: Date.now(), timeZone: deviceTimeZone(), newId });
  // Setting localOnly makes the route guard open onboarding.
  const startLocal = () => updateSettings(db, { localOnly: true, demoMode: false });
  return <SignInView onTryDemo={tryDemo} onStartLocal={startLocal} />;
}

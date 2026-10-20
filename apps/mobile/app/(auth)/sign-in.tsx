import { db } from '@/db/client';
import { seedDemo } from '@/db/seed-demo';
import { SignInView } from '@/features/auth/sign-in-view';
import { deviceTimeZone, newId } from '@/lib/device';

export default function SignIn() {
  // Seeding flips settings.demoMode, and the route guard then moves the user to the tabs.
  const tryDemo = () => seedDemo(db, { now: Date.now(), timeZone: deviceTimeZone(), newId });
  return <SignInView onTryDemo={tryDemo} />;
}

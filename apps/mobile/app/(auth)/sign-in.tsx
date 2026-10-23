import { router } from 'expo-router';

import { db } from '@/db/client';
import { updateSettings } from '@/db/queries/settings';
import { seedDemo } from '@/db/seed-demo';
import { SignInView } from '@/features/auth/sign-in-view';
import { deviceTimeZone, newId } from '@/lib/device';
import { sendCode } from '@/lib/supabase';

export default function SignIn() {
  const onSendCode = async (email: string) => {
    const result = await sendCode(email);
    if (!result.ok) return result.message;
    router.push({ pathname: '/verify', params: { email } });
    return null;
  };
  // Seeding flips settings.demoMode, and the route guard then moves the user to the tabs.
  const tryDemo = () => seedDemo(db, { now: Date.now(), timeZone: deviceTimeZone(), newId });
  // Setting localOnly makes the route guard open onboarding.
  const startLocal = () => updateSettings(db, { localOnly: true, demoMode: false });
  return <SignInView onSendCode={onSendCode} onTryDemo={tryDemo} onStartLocal={startLocal} />;
}

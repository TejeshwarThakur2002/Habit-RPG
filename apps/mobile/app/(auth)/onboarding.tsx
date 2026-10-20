import { useState } from 'react';

import { db } from '@/db/client';
import { createHero } from '@/db/queries/local-data';
import { OnboardingView } from '@/features/onboarding/onboarding-view';
import { deviceTimeZone } from '@/lib/device';

export default function Onboarding() {
  const [detected] = useState(deviceTimeZone);
  // createHero marks onboarding done, and the route guard then opens the tabs.
  return (
    <OnboardingView
      detectedTimeZone={detected}
      onFinish={(input) => createHero(db, { ...input, now: Date.now() })}
    />
  );
}

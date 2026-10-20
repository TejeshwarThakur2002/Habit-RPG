import { Button } from '@habit-rpg/ui';

import { TabPlaceholder } from '@/components/tab-placeholder';
import { db } from '@/db/client';
import { updateSettings } from '@/db/queries/settings';

export default function Stats() {
  return (
    <TabPlaceholder title="Adventure Log" note="Your stats arrive in a Phase 2 update.">
      {/* Settings (with Sign out) comes later in Phase 2; until then this ends the demo. */}
      <Button
        label="Leave the demo"
        variant="danger"
        onPress={() => updateSettings(db, { demoMode: false, onboardingDone: false })}
      />
    </TabPlaceholder>
  );
}

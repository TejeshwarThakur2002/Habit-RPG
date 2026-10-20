import { Button } from '@habit-rpg/ui';
import { router } from 'expo-router';

import { TabPlaceholder } from '@/components/tab-placeholder';

export default function Quests() {
  return (
    <TabPlaceholder title="Quest Board" note="Your quests arrive in the next Phase 2 update.">
      {__DEV__ && (
        <Button
          label="Open UI gallery"
          variant="secondary"
          onPress={() => router.push('/dev/gallery')}
        />
      )}
    </TabPlaceholder>
  );
}

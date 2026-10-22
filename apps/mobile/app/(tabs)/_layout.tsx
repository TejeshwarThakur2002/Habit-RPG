import { colors, fonts } from '@habit-rpg/ui';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TabIcon, type TabName } from '@/components/tab-icon';
import { db } from '@/db/client';
import { dismissFaint, getPendingFaint } from '@/db/queries/day-close';
import { useDbQuery } from '@/db/use-db-query';
import { FaintedModal } from '@/features/day-close/fainted-modal';
import { useDayClose } from '@/features/day-close/use-day-close';

const TABS: { route: string; title: string; icon: TabName }[] = [
  { route: 'index', title: 'Quests', icon: 'quests' },
  { route: 'party', title: 'Party', icon: 'party' },
  { route: 'hero', title: 'Hero', icon: 'hero' },
  { route: 'stats', title: 'Stats', icon: 'stats' },
];

/**
 * Four equal tabs, 84 tall with the safe area, labels always visible (SCOPE.md section 5.1).
 * The tabs also close finished days and show the "You fainted" modal (F4).
 */
export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  useDayClose();
  const faint = useDbQuery(() => getPendingFaint(db));
  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: colors.bg },
          tabBarActiveTintColor: colors.gold,
          tabBarInactiveTintColor: colors.muted,
          tabBarStyle: {
            height: 60 + Math.max(insets.bottom, 24),
            paddingTop: 10,
            backgroundColor: colors.surfaceNav,
            borderTopColor: colors.border,
            borderTopWidth: 1,
          },
          tabBarLabelStyle: { fontFamily: fonts.bodyMedium, fontSize: 11 },
        }}
      >
        {TABS.map(({ route, title, icon }) => (
          <Tabs.Screen
            key={route}
            name={route}
            options={{
              title,
              tabBarAccessibilityLabel: `${title} tab`,
              tabBarIcon: ({ color }) => <TabIcon name={icon} color={color} />,
            }}
          />
        ))}
      </Tabs>
      <FaintedModal notice={faint} onClose={() => dismissFaint(db)} />
    </>
  );
}

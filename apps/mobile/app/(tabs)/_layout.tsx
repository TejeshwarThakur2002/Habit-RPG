import { colors, fonts } from '@habit-rpg/ui';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TabIcon, type TabName } from '@/components/tab-icon';

const TABS: { route: string; title: string; icon: TabName }[] = [
  { route: 'index', title: 'Quests', icon: 'quests' },
  { route: 'party', title: 'Party', icon: 'party' },
  { route: 'hero', title: 'Hero', icon: 'hero' },
  { route: 'stats', title: 'Stats', icon: 'stats' },
];

/** Four equal tabs, 84 tall with the safe area, labels always visible (SCOPE.md section 5.1). */
export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
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
  );
}

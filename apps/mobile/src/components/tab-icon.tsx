import { StyleSheet, View, type ColorValue, type ViewStyle } from 'react-native';

export type TabName = 'quests' | 'party' | 'hero' | 'stats';

// The design canvas's outline shapes: square, circle, shield and chart axis, 22 pt with 2 pt lines.
const SHAPES: Record<TabName, ViewStyle> = {
  quests: { borderWidth: 2, borderRadius: 4 },
  party: { borderWidth: 2, borderRadius: 11 },
  hero: {
    borderWidth: 2,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    borderBottomLeftRadius: 11,
    borderBottomRightRadius: 11,
  },
  stats: { borderLeftWidth: 2, borderBottomWidth: 2 },
};

export function TabIcon({ name, color }: { name: TabName; color: ColorValue }) {
  return <View style={[styles.icon, SHAPES[name], { borderColor: color }]} />;
}

const styles = StyleSheet.create({
  icon: { width: 22, height: 22 },
});

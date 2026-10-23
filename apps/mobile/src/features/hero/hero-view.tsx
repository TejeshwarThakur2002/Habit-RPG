import type { GearId } from '@habit-rpg/game-core';
import { Chip, ScreenHeader, Toast, colors, spacing, type } from '@habit-rpg/ui';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { HeroSheet } from '@/db/queries/gear';

import { GearShop } from './gear-shop';
import { HeroSheetCard } from './hero-sheet-card';

export interface HeroToast {
  message: string;
  /** Set after a purchase, for the Undo button. */
  undo?: () => void;
}

export interface HeroViewProps {
  sheet: HeroSheet;
  toast: HeroToast | null;
  onBuy: (itemId: GearId) => void;
  onEquip: (itemId: GearId, on: boolean) => void;
  onToastDone: () => void;
}

/** The Hero tab (SCOPE.md section 5.6). */
export function HeroView({ sheet, toast, onBuy, onEquip, onToastDone }: HeroViewProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}>
        <ScreenHeader
          title="Your Hero"
          right={<Chip color="gold" label={`${sheet.gold} gold`} />}
        />
        <HeroSheetCard sheet={sheet} />
        <Text style={type.meta}>
          Body habits raise STR, Mind habits raise INT, Health habits raise CON. LUCK grows with
          your best streak.
        </Text>
        <GearShop sheet={sheet} onBuy={onBuy} onEquip={onEquip} />
      </ScrollView>
      {toast && (
        <View style={styles.toast}>
          <Toast
            key={toast.message}
            message={toast.message}
            action={toast.undo && { label: 'Undo', onPress: toast.undo }}
            onDismiss={onToastDone}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { gap: spacing.section, paddingHorizontal: spacing.screenX, paddingBottom: 96 },
  toast: { position: 'absolute', left: spacing.screenX, right: spacing.screenX, bottom: 16 },
});

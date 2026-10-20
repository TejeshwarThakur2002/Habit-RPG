import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MIN_TOUCH, borders, colors, fonts, radii, type } from '../tokens';

export type ShopItemState =
  | { kind: 'buyable' }
  | { kind: 'expensive'; goldNeeded: number }
  | { kind: 'owned' }
  | { kind: 'equipped' }
  | { kind: 'locked'; unlockLevel: number };

export interface ShopItemProps {
  name: string;
  /** e.g. "+2 CON · blocks 1 missed daily". */
  effect: string;
  price: number;
  state: ShopItemState;
  icon: ReactNode;
  /** Buy when buyable, equip when owned, unequip when equipped. */
  onPress?: () => void;
}

interface ActionLook {
  label: string;
  a11y: string;
  disabled: boolean;
  tone: 'gold' | 'outline' | 'teal';
}

function actionFor(name: string, price: number, state: ShopItemState): ActionLook {
  switch (state.kind) {
    case 'buyable':
      return {
        label: `${price} g`,
        a11y: `Buy ${name} for ${price} gold`,
        disabled: false,
        tone: 'gold',
      };
    case 'expensive':
      return {
        label: `${price} g`,
        a11y: `${name}, ${price} gold, need ${state.goldNeeded} more gold`,
        disabled: true,
        tone: 'outline',
      };
    case 'owned':
      return { label: 'Equip', a11y: `Equip ${name}`, disabled: false, tone: 'outline' };
    case 'equipped':
      return {
        label: 'Equipped',
        a11y: `Unequip ${name}, currently equipped`,
        disabled: false,
        tone: 'teal',
      };
    case 'locked':
      return {
        label: `${price} g`,
        a11y: `${name}, unlocks at level ${state.unlockLevel}`,
        disabled: true,
        tone: 'outline',
      };
  }
}

/** SCOPE.md section 5.2 ShopItem: buyable, too expensive, owned, equipped and locked. */
export function ShopItem({ name, effect, price, state, icon, onPress }: ShopItemProps) {
  const action = actionFor(name, price, state);
  const locked = state.kind === 'locked';
  const caption =
    state.kind === 'locked'
      ? `Unlocks at level ${state.unlockLevel}`
      : state.kind === 'expensive'
        ? `${effect} · Need ${state.goldNeeded} more gold`
        : effect;

  return (
    <View style={[styles.card, locked && styles.cardLocked]}>
      <View style={[styles.icon, locked && styles.iconLocked]}>{icon}</View>
      <View style={styles.text}>
        <Text style={[styles.name, locked && styles.nameLocked]}>{name}</Text>
        <Text style={type.meta}>{caption}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={action.a11y}
        accessibilityState={{ disabled: action.disabled }}
        disabled={action.disabled}
        onPress={onPress}
        style={[styles.action, actionStyles[action.tone], action.disabled && styles.actionDisabled]}
      >
        <Text
          style={[
            styles.actionLabel,
            {
              color:
                action.tone === 'gold'
                  ? colors.bg
                  : action.tone === 'teal'
                    ? colors.teal
                    : colors.text,
            },
            action.disabled && styles.labelDisabled,
          ]}
        >
          {action.label}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radii.card,
    borderWidth: borders.card,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cardLocked: {
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceNav,
  },
  icon: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: 8,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLocked: { opacity: 0.6 },
  text: { flex: 1, minWidth: 0, gap: 2 },
  // Inter 600 is its own font file; fontWeight on a custom font is unreliable on Android.
  name: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.text },
  nameLocked: { color: colors.textSoft },
  action: {
    minWidth: 72,
    minHeight: MIN_TOUCH,
    paddingHorizontal: 10,
    borderRadius: radii.button,
    borderWidth: borders.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionDisabled: { borderColor: colors.borderStrong, backgroundColor: 'transparent' },
  actionLabel: { ...type.reward, fontSize: 14 },
  labelDisabled: { color: colors.muted },
});

const actionStyles = StyleSheet.create({
  gold: { backgroundColor: colors.gold, borderColor: colors.gold },
  outline: { borderColor: colors.borderStrong },
  teal: { borderColor: colors.teal },
});

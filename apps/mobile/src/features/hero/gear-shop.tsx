import { GEAR, type GearId } from '@habit-rpg/game-core';
import { ItemIcon } from '@habit-rpg/sprites';
import { SegmentedControl, ShopItem, spacing, type } from '@habit-rpg/ui';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { HeroSheet } from '@/db/queries/gear';

import { gearEffect, shopState } from './gear-text';

type Tab = 'shop' | 'owned';
const TABS = [
  { value: 'shop', label: 'Shop' },
  { value: 'owned', label: 'Owned' },
] as const;

export interface GearShopProps {
  sheet: HeroSheet;
  onBuy: (itemId: GearId) => void;
  onEquip: (itemId: GearId, on: boolean) => void;
}

/** SCOPE.md section 5.6, item 4: items to buy, and owned items to put on or take off. */
export function GearShop({ sheet, onBuy, onEquip }: GearShopProps) {
  const [tab, setTab] = useState<Tab>('shop');
  const owned = new Set(sheet.inventory.map((r) => r.itemId));
  const items = GEAR.filter((item) => owned.has(item.id) === (tab === 'owned'));

  return (
    <View style={styles.root}>
      <View>
        <Text accessibilityRole="header" style={type.sectionTitle}>
          Gear shop
        </Text>
        <Text style={type.meta}>Cosmetic only, no real money</Text>
      </View>
      <SegmentedControl label="Gear" options={TABS} value={tab} onChange={setTab} />
      {items.length === 0 && (
        <Text style={type.secondary}>
          {tab === 'owned' ? 'Nothing yet. Buy gear in the Shop tab.' : 'You own every item.'}
        </Text>
      )}
      {items.map((item) => {
        const state = shopState(item, sheet, sheet.inventory);
        const onPress =
          state.kind === 'buyable'
            ? () => onBuy(item.id)
            : state.kind === 'owned' || state.kind === 'equipped'
              ? () => onEquip(item.id, state.kind === 'owned')
              : undefined;
        return (
          <ShopItem
            key={item.id}
            name={item.name}
            effect={gearEffect(item)}
            price={item.price}
            state={state}
            icon={<ItemIcon id={item.id} grey={state.kind === 'locked'} />}
            onPress={onPress}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.row + 4 },
});

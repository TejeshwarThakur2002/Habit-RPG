import { gearItem, type GearId } from '@habit-rpg/game-core';
import { useState } from 'react';

import { db } from '@/db/client';
import {
  buyGear,
  getHeroSheet,
  setEquipped,
  undoPurchase,
  type BuyResult,
} from '@/db/queries/gear';
import { LOCAL_USER_ID } from '@/db/types';
import { useDbQuery } from '@/db/use-db-query';
import { HeroView, type HeroToast } from '@/features/hero/hero-view';
import { newId } from '@/lib/device';

const user = LOCAL_USER_ID;

function refusal(name: string, result: Exclude<BuyResult, { ok: true }>): string {
  if (result.reason === 'owned') return `You already own the ${name}`;
  if (result.reason === 'locked') return `The ${name} unlocks at level ${result.unlockLevel}`;
  return `You need ${result.goldNeeded} more gold for the ${name}`;
}

export default function Hero() {
  const sheet = useDbQuery(() => getHeroSheet(db, user));
  const [toast, setToast] = useState<HeroToast | null>(null);
  if (!sheet) return null;

  const buy = (itemId: GearId) => {
    const name = gearItem(itemId).name;
    const result = buyGear(db, { userId: user, itemId, now: Date.now(), newId });
    if (!result.ok) {
      // The button is disabled in these cases, so this only happens after a fast double tap.
      setToast({ message: refusal(name, result) });
      return;
    }
    setToast({
      message: `Bought ${name}`,
      undo: () => {
        undoPurchase(db, user, result.inventoryId, Date.now());
        setToast(null);
      },
    });
  };

  return (
    <HeroView
      sheet={sheet}
      toast={toast}
      onBuy={buy}
      onEquip={(itemId, on) => setEquipped(db, user, itemId, on, Date.now())}
      onToastDone={() => setToast(null)}
    />
  );
}

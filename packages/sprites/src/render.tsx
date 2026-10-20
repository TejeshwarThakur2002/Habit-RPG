import { BOSS_NAMES, GEAR, type BossKey, type GearId, type HeroClass } from '@habit-rpg/game-core';
import { memo } from 'react';
import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import {
  BOSSES,
  BOSS_COLS,
  BOSS_ROWS,
  GEAR_ART,
  HEROES,
  HERO_COLS,
  HERO_ROWS,
  type Matrix,
} from './art';
import { PALETTE, TRANSPARENT, desaturate, type PaletteKey } from './palette';

export interface Run {
  x: number;
  y: number;
  width: number;
  key: PaletteKey;
}

/** Merges each row's neighbouring same-colour cells into one rectangle. */
export function toRuns(matrix: Matrix): Run[] {
  const runs: Run[] = [];
  matrix.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const key = row[x] as string;
      let end = x + 1;
      while (end < row.length && row[end] === key) end += 1;
      if (key !== TRANSPARENT) runs.push({ x, y, width: end - x, key: key as PaletteKey });
      x = end;
    }
  });
  return runs;
}

interface PixelArtProps {
  layers: readonly Matrix[];
  cols: number;
  rows: number;
  /** On-screen size of one cell in points; keep it whole so edges stay sharp. */
  cell: number;
  label: string;
  grey?: boolean;
}

// The viewBox is in cells, so every rectangle sits on whole units and stays crisp
// (react-native-svg has no shapeRendering; DECISIONS.md D14).
function PixelArt({ layers, cols, rows, cell, label, grey }: PixelArtProps) {
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label}>
      <Svg width={cols * cell} height={rows * cell} viewBox={`0 0 ${cols} ${rows}`}>
        {layers.flatMap((layer, i) =>
          toRuns(layer).map((run) => (
            <Rect
              key={`${i}-${run.x}-${run.y}`}
              x={run.x}
              y={run.y}
              width={run.width}
              height={1}
              fill={grey ? desaturate(PALETTE[run.key]) : PALETTE[run.key]}
            />
          )),
        )}
      </Svg>
    </View>
  );
}

/** Layers for a hero: capes behind the body, other gear on top, in shop order. */
export function heroLayers(heroClass: HeroClass, equipped: readonly GearId[]): Matrix[] {
  const worn = GEAR.filter((item) => equipped.includes(item.id)).map((item) => GEAR_ART[item.id]);
  return [
    ...worn.filter((art) => art.layer === 'back').map((art) => art.matrix),
    HEROES[heroClass],
    ...worn.filter((art) => art.layer === 'front').map((art) => art.matrix),
  ];
}

export interface HeroSpriteProps {
  heroClass: HeroClass;
  equipped?: readonly GearId[];
  cell?: number;
  /** Defaults to e.g. "Your knight". */
  label?: string;
}

export const HeroSprite = memo(function HeroSprite(props: HeroSpriteProps) {
  const { heroClass, equipped = [], cell = 8 } = props;
  return (
    <PixelArt
      layers={heroLayers(heroClass, equipped)}
      cols={HERO_COLS}
      rows={HERO_ROWS}
      cell={cell}
      label={props.label ?? `Your ${heroClass}`}
    />
  );
});

export interface BossSpriteProps {
  boss: BossKey;
  /** Drawn in greys, and said in the label. */
  defeated?: boolean;
  cell?: number;
}

export const BossSprite = memo(function BossSprite({ boss, defeated, cell = 12 }: BossSpriteProps) {
  const name = BOSS_NAMES[boss];
  return (
    <PixelArt
      layers={[BOSSES[boss]]}
      cols={BOSS_COLS}
      rows={BOSS_ROWS}
      cell={cell}
      grey={defeated}
      label={defeated ? `${name}, defeated` : name}
    />
  );
});

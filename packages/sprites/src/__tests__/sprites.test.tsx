import { BOSS_ROSTER, GEAR } from '@habit-rpg/game-core';
import { render, screen } from '@testing-library/react-native';

import {
  BOSSES,
  BOSS_COLS,
  BOSS_ROWS,
  GEAR_ART,
  HEROES,
  HERO_COLS,
  HERO_ROWS,
  type Matrix,
} from '../art';
import { ITEM_COLS, ITEM_ICONS, ITEM_ROWS } from '../items';
import { PALETTE, TRANSPARENT, desaturate, isPaletteKey } from '../palette';
import { BossSprite, HeroSprite, ItemIcon, heroLayers, toRuns } from '../render';

// SCOPE.md section 5.2: every matrix has the right dimensions and only valid palette indices.
function expectValidMatrix(matrix: Matrix, cols: number, rows: number) {
  expect(matrix).toHaveLength(rows);
  for (const row of matrix) {
    expect(row).toHaveLength(cols);
    for (const char of row) {
      expect(char === TRANSPARENT || isPaletteKey(char)).toBe(true);
    }
  }
}

describe('sprite data', () => {
  it.each(Object.entries(HEROES))('hero %s is 10 x 12 with valid colours', (_, matrix) => {
    expectValidMatrix(matrix, HERO_COLS, HERO_ROWS);
  });

  it.each(Object.entries(GEAR_ART))('gear %s is 10 x 12 with valid colours', (_, art) => {
    expectValidMatrix(art.matrix, HERO_COLS, HERO_ROWS);
  });

  it.each(Object.entries(ITEM_ICONS))('item icon %s is 8 x 8 with valid colours', (_, matrix) => {
    expectValidMatrix(matrix, ITEM_COLS, ITEM_ROWS);
  });

  it('has an icon for every shop item', () => {
    expect(Object.keys(ITEM_ICONS).sort()).toEqual(GEAR.map((g) => g.id).sort());
  });

  it.each(Object.entries(BOSSES))('boss %s is 12 x 8 with valid colours', (_, matrix) => {
    expectValidMatrix(matrix, BOSS_COLS, BOSS_ROWS);
  });

  it('has art for every class, every shop item and every boss in the roster', () => {
    expect(Object.keys(HEROES).sort()).toEqual(['knight', 'mage', 'rogue']);
    expect(Object.keys(GEAR_ART).sort()).toEqual(GEAR.map((g) => g.id).sort());
    expect(Object.keys(BOSSES).sort()).toEqual([...BOSS_ROSTER].sort());
  });

  it('keeps every palette colour a 6-digit hex value', () => {
    for (const hex of Object.values(PALETTE)) expect(hex).toMatch(/^#[0-9A-F]{6}$/);
  });
});

describe('renderer helpers', () => {
  it('merges neighbouring cells of one colour and skips transparent ones', () => {
    expect(toRuns(['.GGW', 'GG..'])).toEqual([
      { x: 1, y: 0, width: 2, key: 'G' },
      { x: 3, y: 0, width: 1, key: 'W' },
      { x: 0, y: 1, width: 2, key: 'G' },
    ]);
  });

  it('draws capes behind the hero and other gear in front', () => {
    const layers = heroLayers('knight', ['iron-sword', 'dragon-cape']);
    expect(layers[0]).toBe(GEAR_ART['dragon-cape'].matrix);
    expect(layers[1]).toBe(HEROES.knight);
    expect(layers[2]).toBe(GEAR_ART['iron-sword'].matrix);
  });

  it('greys a colour to its perceived brightness', () => {
    expect(desaturate('#FFFFFF')).toBe('#FFFFFF');
    expect(desaturate('#000000')).toBe('#000000');
    // 0.299 * 89 + 0.587 * 201 + 0.114 * 139 = 160.4 -> 0xA0
    expect(desaturate('#59C98B')).toBe('#A0A0A0');
  });
});

describe('components', () => {
  it('labels the hero sprite as an image', async () => {
    await render(<HeroSprite heroClass="mage" equipped={['wizard-hat']} />);
    expect(screen.getByRole('image', { name: 'Your mage' })).toBeOnTheScreen();
  });

  it('says when a boss is defeated', async () => {
    await render(
      <>
        <BossSprite boss="procrastination-slime" />
        <BossSprite boss="monday" defeated />
      </>,
    );
    expect(screen.getByRole('image', { name: 'Procrastination Slime' })).toBeOnTheScreen();
    expect(screen.getByRole('image', { name: 'Monday, defeated' })).toBeOnTheScreen();
  });
});

describe('ItemIcon', () => {
  it('draws the item at 24 pt, named for screen readers', async () => {
    await render(<ItemIcon id="oak-shield" />);
    expect(screen.getByRole('image', { name: 'Oak Shield' })).toBeOnTheScreen();
  });
});

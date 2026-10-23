// Shop item icons: original 8 x 8 pixel art in the sprite palette (SCOPE.md section 5.6).
// They show each item on its own, unlike GEAR_ART, which draws it onto the hero.

import type { GearId } from '@habit-rpg/game-core';

import type { Matrix } from './art';

export const ITEM_COLS = 8;
export const ITEM_ROWS = 8;

export const ITEM_ICONS: Readonly<Record<GearId, Matrix>> = {
  'iron-sword': [
    '......WW',
    '.....WHW',
    '....WHW.',
    '.G.WHW..',
    '..GHW...',
    '..bG....',
    '.bb.G...',
    'bb......',
  ],
  'oak-shield': [
    '.bbbbbb.',
    'bbBbbBbb',
    'bbBGGBbb',
    'bbBGGBbb',
    'bbBbbBbb',
    '.bbBBbb.',
    '..bbbb..',
    '...bb...',
  ],
  'wizard-hat': [
    '....D...',
    '...DP...',
    '...DPD..',
    '..DPPD..',
    '..DPGPD.',
    '.DPPPPD.',
    'DDDDDDDD',
    '.DDDDDD.',
  ],
  'leather-boots': [
    '........',
    'bb..bb..',
    'bb..bb..',
    'bb..bb..',
    'bbb.bbb.',
    'bbbbbbbb',
    'BBB.BBB.',
    '........',
  ],
  'lucky-clover-charm': [
    '..G.....',
    '.G.G....',
    '..gg.gg.',
    '.gggggg.',
    '..gqqg..',
    '.gggggg.',
    '..gg.gg.',
    '....q...',
  ],
  'dragon-cape': [
    '.RRRRRR.',
    'RRrGGrRR',
    'RRRRRRRR',
    'RRRrrRRR',
    'RRRrrRRR',
    'RRRRRRRR',
    'RrRRRRrR',
    'r.r..r.r',
  ],
};

// Original pixel art as palette-key matrices. Heroes and gear are 10 x 12 cells, bosses
// 12 x 8 (SCOPE.md section 5.2). The Knight and the Procrastination Slime are copied cell for
// cell from the "Habit RPG Screens" design canvas; the rest follow their style.

import type { BossKey, GearId, HeroClass } from '@habit-rpg/game-core';

export type Matrix = readonly string[];

export const HERO_COLS = 10;
export const HERO_ROWS = 12;
export const BOSS_COLS = 12;
export const BOSS_ROWS = 8;

// Heroes carry no weapon of their own: the Iron Sword overlay adds one.
export const HEROES: Readonly<Record<HeroClass, Matrix>> = {
  knight: [
    '..HHHHH...',
    '.HHHHHHH..',
    '.HVVVVVH..',
    '.HSSSSSH..',
    '..SSSSS...',
    '.PPGPPPP..',
    'PPPGPPPPP.',
    'P.DPGPDP..',
    'S.DDDDD...',
    '..DD.DD...',
    '..BB.BB...',
    '.BBB.BBB..',
  ],
  mage: [
    '....tt....',
    '...tTTt...',
    '..tTTTTt..',
    '.tttttttt.',
    '..SSSSS...',
    '..SKSKS...',
    '.TTTGTTT..',
    'TTTTGTTTT.',
    'STTTTTTTS.',
    '.TTTTTTT..',
    '.tTTTTTt..',
    '..BB.BB...',
  ],
  rogue: [
    '...nnnn...',
    '..nnnnnn..',
    '.nnSSSSnn.',
    '.nSKSSKSn.',
    '.nnSSSSnn.',
    '..nnnnnn..',
    '.eeeBeeee.',
    'eeeeBeeeee',
    'S.eeeeee.S',
    '..ee..ee..',
    '..BB..BB..',
    '.BBB..BBB.',
  ],
};

export interface GearArt {
  /** Back layers draw behind the hero (a cape), front layers on top. */
  layer: 'back' | 'front';
  matrix: Matrix;
}

const EMPTY_ROW = '..........';
const rows = (fill: Partial<Record<number, string>>): Matrix =>
  Array.from({ length: HERO_ROWS }, (_, i) => fill[i] ?? EMPTY_ROW);

export const GEAR_ART: Readonly<Record<GearId, GearArt>> = {
  'iron-sword': {
    layer: 'front',
    matrix: rows({
      3: '.........W',
      4: '.........W',
      5: '.........W',
      6: '.........W',
      7: '........GG',
    }),
  },
  'oak-shield': {
    layer: 'front',
    matrix: rows({ 5: 'bb........', 6: 'bG........', 7: 'bb........', 8: '.b........' }),
  },
  'wizard-hat': {
    layer: 'front',
    // Wide enough to cover every class's headgear on rows 0-2.
    matrix: rows({ 0: '..DDPDD...', 1: '.DDPPPDD..', 2: '.DDDGDDD..' }),
  },
  'leather-boots': {
    layer: 'front',
    matrix: rows({ 10: '..bb.bb...', 11: '.bbb.bbb..' }),
  },
  'lucky-clover-charm': {
    layer: 'front',
    matrix: rows({ 6: '.....g....', 7: '....g.g...' }),
  },
  'dragon-cape': {
    layer: 'back',
    matrix: rows({
      5: 'R........R',
      6: 'R........R',
      7: 'R........R',
      8: 'Rr......rR',
      9: 'Rr......rR',
      10: 'rr......rr',
    }),
  },
};

export const BOSSES: Readonly<Record<BossKey, Matrix>> = {
  'procrastination-slime': [
    '....gggg....',
    '..gggggggg..',
    '.gglggggggg.',
    'gggKggggKggg',
    'gggKggggKggg',
    'ggggqqqqgggg',
    'qqqqqqqqqqqq',
    '.q....q...q.',
  ],
  'snooze-goblin': [
    '..o......o..',
    '.oEEEEEEEEo.',
    '..EEEEEEEE..',
    '..EKKEEKKE..',
    '..EEEEEEEE..',
    '...EEwwEE...',
    '..oooooooo..',
    '.oo......oo.',
  ],
  'doomscroll-wraith': [
    '....XXXX....',
    '...XXXXXX...',
    '..XXKXXKXX..',
    '..XXXXXXXX..',
    '.XXXXXTTXXX.',
    '.XXXXXTTXXX.',
    '.XXXXXXXXXX.',
    '.x.x.x.x.x..',
  ],
  'couch-golem': [
    '............',
    '.BBBBBBBBBB.',
    '.BbbbbbbbbB.',
    'BBbKbbbbKbBB',
    'BBbbbbbbbbBB',
    'BBOOOOOOOOBB',
    'BBBBBBBBBBBB',
    '.B........B.',
  ],
  'deadline-dragon': [
    '..G......G..',
    '..rRRRRRRr..',
    '.rRRRRRRRRr.',
    '.RRGKRRGKRR.',
    'RRRRRRRRRRRR',
    'RRwRwRRwRwRR',
    '.rRRRRRRRRr.',
    '..rr....rr..',
  ],
  'junk-food-ogre': [
    '...YYYYYY...',
    '..YOOOOOOY..',
    '.OOOOOOOOOO.',
    '.OOKOOOOKOO.',
    '.OOOOOOOOOO.',
    '.OORRRRRROO.',
    '..uuuuuuuu..',
    '.uu......uu.',
  ],
  'burnout-specter': [
    '..O..Y..O...',
    '.OYO.OYO.OY.',
    '..MMMMMMMM..',
    '.MMKMMMMKMM.',
    '.MMMMMMMMMM.',
    '.MMMmmmmMMM.',
    '.MMMMMMMMMM.',
    '.m.m.m.m.m..',
  ],
  monday: [
    '..K......K..',
    '.RRRRRRRRRR.',
    '.RRRRRRRRRR.',
    '.wwwwwwwwww.',
    '.wwKwwwwKww.',
    '.wwwwwwwwww.',
    '.wwwKKKKwww.',
    '.wwwwwwwwww.',
  ],
};

// One shared palette for every sprite. A sprite is a list of equal-length strings; each
// character is a palette key, and '.' is transparent (SCOPE.md section 5.2, "Sprites").
// Hex values live here, in sprite data, not in screens.

export const TRANSPARENT = '.';

export const PALETTE = {
  K: '#14121F', // outline, eyes
  H: '#C9CCD6', // steel helmet
  W: '#E6E9F0', // blade
  V: '#2A2638', // visor
  S: '#E9B48A', // skin
  P: '#8B7CF6', // purple armour
  D: '#5B4FC4', // dark purple
  G: '#F2B84B', // gold
  B: '#6B4E33', // dark leather
  b: '#9C6B3E', // light leather, wood
  T: '#4FD1B5', // teal robe
  t: '#2F8F7A', // dark teal
  n: '#2F5A42', // dark green hood
  e: '#3C8C72', // green cloak
  g: '#59C98B', // slime green, clover
  q: '#2F8F5B', // dark slime green
  l: '#B8F5D0', // slime shine
  E: '#7FB069', // goblin skin
  o: '#4A6B3A', // dark goblin
  X: '#C9C4DB', // wraith
  x: '#5E5878', // wraith shadow
  R: '#B4505C', // dragon red, cape
  r: '#7A3B44', // dark red
  w: '#F2EEE3', // teeth, paper
  O: '#F08A4B', // orange
  u: '#A65A2E', // dark orange
  Y: '#F2D16B', // fries, flame tip
  M: '#A8A2BD', // specter grey
  m: '#5E5878', // dark grey
} as const;

export type PaletteKey = keyof typeof PALETTE;

export function isPaletteKey(char: string): char is PaletteKey {
  return Object.prototype.hasOwnProperty.call(PALETTE, char);
}

/** Grey with the same perceived brightness, for a defeated boss. */
export function desaturate(hex: string): string {
  const value = parseInt(hex.slice(1), 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  const grey = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  const part = grey.toString(16).padStart(2, '0');
  return `#${part}${part}${part}`.toUpperCase();
}

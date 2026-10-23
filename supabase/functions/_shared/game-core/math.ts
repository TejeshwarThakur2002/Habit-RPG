// Generated from packages/game-core/src/math.ts by scripts/copy-functions-shared.mjs.
// Do not edit; change the source and run `pnpm functions:shared`.

// Integer helpers. Rewards are computed with integers only so the phone (Hermes) and the
// server (Deno) can never disagree because of floating-point rounding.

/** Rounds `numerator / denominator` to the nearest integer, halves up. Inputs are non-negative. */
export function divRound(numerator: number, denominator: number): number {
  return Math.floor((2 * numerator + denominator) / (2 * denominator));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * FNV-1a 32-bit hash of a string's UTF-16 code units, as an unsigned integer.
 * Used to seed the crit roll from a completion id so every device gets the same answer
 * (SCOPE.md section 3, "deterministic, same on device and server"; DECISIONS.md D10).
 */
export function hash32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

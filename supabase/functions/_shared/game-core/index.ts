// Generated from packages/game-core/src/index.ts by scripts/copy-functions-shared.mjs.
// Do not edit; change the source and run `pnpm functions:shared`.

// Pure game rules (SCOPE.md section 3), shared by the app and the Edge Functions.
// No runtime dependencies, no clock and no device time zone: callers pass everything in.
export * from './boss.ts';
export * from './constants.ts';
export * from './character.ts';
export * from './dates.ts';
export * from './day-close.ts';
export * from './gear.ts';
export { clamp, divRound, hash32 } from './math.ts';
export * from './reminders.ts';
export * from './rewards.ts';
export * from './stats.ts';
export * from './streaks.ts';

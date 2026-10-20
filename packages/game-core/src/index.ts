// Pure game rules (SCOPE.md section 3), shared by the app and the Edge Functions.
// No runtime dependencies, no clock and no device time zone: callers pass everything in.
export * from './constants';
export * from './character';
export { clamp, divRound, hash32 } from './math';
export * from './rewards';

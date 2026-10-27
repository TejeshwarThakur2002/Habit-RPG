// The end-to-end sync tests (D53): phones on sql.js against the local Supabase stack's real
// `sync` function. They need the stack running, so they run with `pnpm sync:test` and in CI's
// supabase job, not in `pnpm test`.
module.exports = {
  displayName: 'sync-e2e',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/sync/__e2e__/**/*.test.ts'],
  transform: { '\\.[jt]sx?$': 'babel-jest' },
  transformIgnorePatterns: ['/node_modules/(?!(\\.pnpm/)?(drizzle-orm|@habit-rpg))'],
  testTimeout: 60_000,
};

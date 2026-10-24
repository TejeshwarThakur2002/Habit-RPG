// Two Jest projects: React Native screens and components run under jest-expo; database
// queries and the sync engine run in plain Node against sql.js, without React Native's polyfills
// (DECISIONS.md D17, D46).
module.exports = {
  projects: [
    {
      displayName: 'app',
      preset: 'jest-expo',
      setupFilesAfterEnv: ['<rootDir>/../../packages/ui/jest.setup.js', '<rootDir>/jest.setup.js'],
      testPathIgnorePatterns: ['/node_modules/', '<rootDir>/src/db/', '<rootDir>/src/sync/'],
    },
    {
      displayName: 'db',
      testEnvironment: 'node',
      testMatch: [
        '<rootDir>/src/db/**/__tests__/**/*.test.ts',
        '<rootDir>/src/sync/**/__tests__/**/*.test.ts',
      ],
      transform: { '\\.[jt]sx?$': 'babel-jest' },
      transformIgnorePatterns: ['/node_modules/(?!(\\.pnpm/)?(drizzle-orm|@habit-rpg))'],
    },
  ],
};

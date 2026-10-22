// Two Jest projects: React Native screens and components run under jest-expo; database
// queries run in plain Node against sql.js, without React Native's polyfills (DECISIONS.md D17).
module.exports = {
  projects: [
    {
      displayName: 'app',
      preset: 'jest-expo',
      setupFilesAfterEnv: ['<rootDir>/../../packages/ui/jest.setup.js', '<rootDir>/jest.setup.js'],
      testPathIgnorePatterns: ['/node_modules/', '<rootDir>/src/db/'],
    },
    {
      displayName: 'db',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/db/**/__tests__/**/*.test.ts'],
      transform: { '\\.[jt]sx?$': 'babel-jest' },
      transformIgnorePatterns: ['/node_modules/(?!(\\.pnpm/)?(drizzle-orm|@habit-rpg))'],
    },
  ],
};

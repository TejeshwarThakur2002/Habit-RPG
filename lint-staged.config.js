module.exports = {
  '*.{js,ts,tsx}': ['eslint --fix --max-warnings=0 --no-warn-ignored', 'prettier --write'],
  '*.{json,md,yml,yaml}': ['prettier --write'],
  // Edge Functions import a copy of these packages (DECISIONS.md D5): refuse a commit that
  // changes them without refreshing the copy (`pnpm functions:shared`).
  'packages/{game-core,shared}/src/**/*.ts': () => 'node scripts/copy-functions-shared.mjs --check',
};

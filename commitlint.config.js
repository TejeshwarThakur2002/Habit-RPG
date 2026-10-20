// Conventional Commits with the types and scopes from SCOPE.md section 12.4.
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'test', 'refactor', 'perf', 'docs', 'chore', 'ci', 'build'],
    ],
    'scope-enum': [
      2,
      'always',
      [
        'mobile',
        'game-core',
        'shared',
        'ui',
        'sprites',
        'db',
        'sync',
        'party',
        'supabase',
        'ci',
        'docs',
      ],
    ],
    'header-max-length': [2, 'always', 72],
    'body-max-line-length': [2, 'always', 100],
  },
};

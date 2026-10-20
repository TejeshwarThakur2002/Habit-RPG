// @ts-check
const { fixupPluginRules } = require('@eslint/compat');
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');
const a11y = require('eslint-plugin-react-native-a11y');

module.exports = defineConfig([
  {
    ignores: [
      '**/node_modules/**',
      '**/.expo/**',
      '**/dist/**',
      '**/coverage/**',
      '**/expo-env.d.ts',
    ],
  },
  expoConfig,
  {
    // The a11y plugin predates flat config; fixupPluginRules adapts it (DECISIONS.md D4).
    files: ['apps/mobile/**/*.tsx', 'packages/ui/**/*.tsx', 'packages/sprites/**/*.tsx'],
    plugins: { 'react-native-a11y': fixupPluginRules(a11y) },
    rules: {
      ...a11y.configs.all.rules,
      // Hints are optional extra context; the scope requires roles and labels, not hints.
      'react-native-a11y/has-accessibility-hint': 'off',
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    // Resolve each workspace's tsconfig paths, such as the app's `@/` alias.
    settings: {
      'import/resolver': {
        typescript: { project: ['apps/*/tsconfig.json', 'packages/*/tsconfig.json'] },
      },
    },
    rules: {
      // SCOPE.md hard rule: no `any` without an eslint-disable comment that explains why.
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  prettierConfig,
]);

// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const globals = require('globals');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // resolve the "@/..." alias from jsconfig.json
    settings: { 'import/resolver': { typescript: { project: './jsconfig.json' } } },
  },
  {
    files: ['**/__tests__/**', '**/*.test.js', 'jest.setup.js'],
    languageOptions: { globals: globals.jest },
  },
  {
    // Cloud Functions and the rules tests run on Node, not in the app
    files: ['functions/**', 'firestore-tests/**'],
    languageOptions: { globals: globals.node },
  },
]);

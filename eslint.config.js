// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const globals = require('globals');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'firebase/tests/node_modules/*'],
  },
  {
    // resolve the "@/..." alias from jsconfig.json
    settings: { 'import/resolver': { typescript: { project: './jsconfig.json' } } },
  },
  {
    files: ['**/__tests__/**', '**/*.test.js'],
    languageOptions: { globals: globals.jest },
  },
]);

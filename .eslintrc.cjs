'use strict';

module.exports = {
  root: true,
  plugins: ['prettier', '@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
  reportUnusedDisableDirectives: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  env: { browser: true },
  overrides: [
    {
      files: ['src/**/*.spec.ts'],
      rules: {
        '@typescript-eslint/no-non-null-assertion': 'off',
      },
    },
    {
      files: ['.eslintrc.cjs', '.prettierrc.cjs', 'rollup.config.js', 'web-test-runner.config.js'],
      env: {
        node: true,
      },
    },
  ],
  rules: {
    'prettier/prettier': ['error'],
  },
};

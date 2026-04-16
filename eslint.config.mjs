import antfu from '@antfu/eslint-config';

export default antfu(
  {
    typescript: true,
    ignores: ['packages/docs/**'],
    stylistic: {
      quotes: 'single',
      overrides: {
        'style/brace-style': 'off',
        'style/member-delimiter-style': ['error', {
          multiline: { delimiter: 'semi' },
          singleline: { delimiter: 'semi' },
        }],
        'style/semi': ['error', 'always'],
        'style/arrow-parens': ['error', 'always'],
        'style/operator-linebreak': ['error', 'after'],
        'style/indent-binary-ops': ['off'],
        'style/jsx-max-props-per-line': ['error', { maximum: 3 }],
        'style/indent': ['error', 2],
      },
    },
  },
  {
    rules: {
      'ts/explicit-function-return-type': 'off',
      'unicorn/number-literal-case': 'off',
      'test/prefer-lowercase-title': ['error', { ignore: ['describe'] }],
      'yaml/flow-mapping-curly-spacing': [2, 'always'],
      'yaml/quotes': ['error', { prefer: 'double' }],
      'antfu/if-newline': 'off',
    },
  },
  {
    files: ['**/*.test.ts'],
    rules: {
      'ts/no-unused-expressions': 'off',
    },
  },
  {
    files: ['packages/playground/**'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    files: ['**/*.config.{js,mjs,ts}'],
    rules: {
      'node/prefer-global/process': 'off',
    },
  },
);

import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    files: ['**/*.{js,cjs,mjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-console': 'off',
    },
  },
  {
    files: ['commitlint.config.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
    },
  },
  {
    ignores: ['node_modules/**'],
  },
];

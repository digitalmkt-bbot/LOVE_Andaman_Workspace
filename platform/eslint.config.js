// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/*.config.js', '**/coverage/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // The API is the only data boundary; an unused var is usually a half-finished thought.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // `any` defeats the point of sharing contracts between api and ops-web.
      '@typescript-eslint/no-explicit-any': 'error',
      // An error, not a warning: `eslint .` exits 0 with any number of warnings,
      // so as a warning this rule could not stop a console.log of a booking
      // payload — request PII in the production log stream — from passing CI.
      'no-console': ['error', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
    },
  },
  {
    // The migration CLI's entire job is to talk to a human on stdout.
    files: ['packages/db/src/cli.ts'],
    rules: { 'no-console': 'off' },
  },
);

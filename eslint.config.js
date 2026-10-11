import tsParser from '@typescript-eslint/parser';

/**
 * Conservative ESLint gate for the pre-format legacy code.
 * TypeScript strict/noUnusedLocals already checks types and unused locals.
 * Broader stylistic rules belong in a separate, formatting-only PR.
 */
export default [
  { ignores: ['dist/**', 'coverage/**', 'playwright-report/**', 'test-results/**'] },
  {
    files: ['src/**/*.ts', 'vite.config.ts', 'playwright.config.ts', 'tests/**/*.ts'],
    languageOptions: { parser: tsParser, ecmaVersion: 'latest', sourceType: 'module' },
    rules: {
      'no-debugger': 'error',
      'no-var': 'error',
      'no-unreachable': 'error',
      'no-constant-condition': 'error',
    },
  },
];

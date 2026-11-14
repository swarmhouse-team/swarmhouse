import js from '@eslint/js';
import nextVitals from 'eslint-config-next/core-web-vitals';
import prettier from 'eslint-config-prettier';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const reactFiles = ['apps/web/**/*.{ts,tsx,js,jsx}', 'packages/ui/**/*.{ts,tsx}'];

export default defineConfig(
  globalIgnores([
    '**/node_modules/**',
    '**/dist/**',
    '**/.next/**',
    '**/coverage/**',
    '**/next-env.d.ts',
    'apps/api/src/generated/**',
  ]),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['apps/api/**/*.{ts,mts}', 'scripts/**', '*.{js,mjs,cjs}'],
    languageOptions: { globals: globals.node },
  },
  {
    files: reactFiles,
    extends: [nextVitals],
    settings: { next: { rootDir: 'apps/web' } },
  },
  prettier,
);

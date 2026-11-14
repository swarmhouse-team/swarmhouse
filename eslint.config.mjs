import js from '@eslint/js';
import nextVitals from 'eslint-config-next/core-web-vitals';
import prettier from 'eslint-config-prettier';
import i18next from 'eslint-plugin-i18next';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const reactFiles = ['apps/web/**/*.{ts,tsx,js,jsx,mjs}', 'packages/ui/**/*.{ts,tsx}'];

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
  {
    // packages/ui — не Next-приложение: маршруты apps/web (там catch-all [locale]/[...rest])
    // к его ссылкам отношения не имеют.
    files: ['packages/ui/**/*.{ts,tsx}'],
    rules: { '@next/next/no-html-link-for-pages': 'off' },
  },
  {
    // Внутренняя навигация — только через shared/i18n: она сохраняет префикс языка в URL.
    files: ['apps/web/src/**/*.{ts,tsx}', 'apps/web/app/**/*.{ts,tsx}'],
    ignores: ['apps/web/src/shared/i18n/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'next/link',
              message: 'Используйте Link из @/shared/i18n: он сохраняет язык в URL.',
            },
            {
              name: 'next/navigation',
              importNames: ['redirect', 'permanentRedirect', 'useRouter', 'usePathname'],
              message: 'Используйте навигацию из @/shared/i18n: она сохраняет язык в URL.',
            },
          ],
        },
      ],
    },
  },
  {
    // Тексты интерфейса — только из словарей (apps/web/src/shared/i18n/messages).
    files: ['apps/web/src/**/*.{ts,tsx}'],
    ignores: ['**/*.spec.{ts,tsx}', '**/*.stories.{ts,tsx}'],
    plugins: { i18next },
    rules: {
      'i18next/no-literal-string': [
        'error',
        {
          mode: 'jsx-only',
          'jsx-attributes': {
            // Технические атрибуты, а не тексты: их не переводят.
            exclude: [
              'className',
              'style',
              'type',
              'key',
              'id',
              'width',
              'height',
              'role',
              'variant',
              'size',
              'href',
              'src',
              'name',
              'htmlFor',
              'rel',
              'target',
              'method',
              'autoComplete',
              'inputMode',
              'locale',
              'data-.*',
            ],
          },
        },
      ],
    },
  },
  prettier,
);

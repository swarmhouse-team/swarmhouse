import fsd from '@feature-sliced/steiger-plugin';
import { defineConfig } from 'steiger';

export default defineConfig([
  ...fsd.configs.recommended,
  {
    // Тесты лежат рядом с кодом и не являются частью публичного API слайса.
    ignores: ['**/*.spec.ts', '**/*.spec.tsx'],
  },
  {
    // По требованиям проекта хедер должен оставаться отдельным виджетом,
    // даже пока он используется только на лендинге.
    files: ['./src/widgets/header/**'],
    rules: {
      'fsd/insignificant-slice': 'off',
    },
  },
  {
    // `app/providers` и `app/styles` — общепринятые сегменты слоя app.
    files: ['./src/app/**'],
    rules: { 'fsd/segments-by-purpose': 'off' },
  },
]);

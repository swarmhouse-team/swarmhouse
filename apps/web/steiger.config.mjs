import fsd from '@feature-sliced/steiger-plugin';
import { defineConfig } from 'steiger';

export default defineConfig([
  ...fsd.configs.recommended,
  {
    // Тесты лежат рядом с кодом и не являются частью публичного API слайса.
    ignores: ['**/*.spec.ts', '**/*.spec.tsx'],
  },
  {
    // `app/providers` и `app/styles` — общепринятые сегменты слоя app.
    files: ['./src/app/**'],
    rules: { 'fsd/segments-by-purpose': 'off' },
  },
  {
    // Эти слайсы выделены отдельно согласно архитектуре страницы складов.
    // Пока они используются одной страницей, но остаются самостоятельными частями интерфейса.
    files: [
      './src/entities/warehouse/**',
      './src/features/warehouse-create/**',
      './src/features/warehouse-delete/**',
      './src/features/warehouse-settings/**',
      './src/widgets/warehouse-list/**',
    ],
    rules: {
      'fsd/insignificant-slice': 'off',
    },
  },
  {
    // Feature-слайсы описывают разные действия над одной сущностью warehouse.
    files: ['./src/features/**'],
    rules: {
      'fsd/repetitive-naming': 'off',
    },
  },
]);

import { resolve } from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.spec.{ts,tsx}'],
    // next-intl импортирует `next/navigation` без расширения — Node ESM это не резолвит,
    // поэтому пакет прогоняем через Vite.
    server: { deps: { inline: ['next-intl'] } },
  },
});

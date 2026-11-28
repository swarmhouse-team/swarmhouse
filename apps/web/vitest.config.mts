import { resolve } from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vitest/config';

// SVG в тестах отдаём React-заглушкой: SVGR работает только в сборке Next.
const svgStubPlugin = (): Plugin => ({
  name: 'svg-stub',
  enforce: 'pre',
  resolveId(source) {
    if (source.endsWith('.svg')) return resolve(import.meta.dirname, 'vitest.svg-stub.tsx');
    return null;
  },
});

export default defineConfig({
  plugins: [react(), svgStubPlugin()],
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'src'),
      '@locales': resolve(import.meta.dirname, 'locales'),
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

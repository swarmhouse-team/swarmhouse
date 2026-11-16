import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    environment: 'node',
    include: ['test/integration/**/*.integration.spec.ts'],
    fileParallelism: false,
    globalSetup: ['test/integration/global-setup.mts'],
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});

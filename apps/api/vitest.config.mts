import swc from 'unplugin-swc';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  // SWC нужен ради emitDecoratorMetadata: без него не работает DI в Nest.
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts', 'test/integration/support/assert-test-database-url.spec.ts'],
    exclude: [...configDefaults.exclude, '**/*.integration.spec.ts'],
  },
});

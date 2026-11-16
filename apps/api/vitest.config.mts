import swc from 'unplugin-swc';
import { configDefaults, defineConfig } from 'vitest/config';

// `*.transport.spec.ts` stays out of `vitest run` and `vitest run src/warehouse`.
// The explicit transport path opts this config into that file only, so the
// documented command still runs it.
const transportOnly = process.argv.some((argument) => argument.includes('.transport.spec.ts'));

export default defineConfig({
  // SWC нужен ради emitDecoratorMetadata: без него не работает DI в Nest.
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    environment: 'node',
    include: transportOnly
      ? ['src/**/*.transport.spec.ts']
      : ['src/**/*.spec.ts', 'test/integration/support/assert-test-database-url.spec.ts'],
    exclude: transportOnly
      ? [...configDefaults.exclude]
      : [...configDefaults.exclude, '**/*.integration.spec.ts', '**/*.transport.spec.ts'],
  },
});

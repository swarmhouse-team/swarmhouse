import { defineConfig } from 'tsup';

export default defineConfig((options) => ({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  // В watch-режиме dist не чистим: api и web читают его, пока идёт пересборка.
  clean: !options.watch,
}));

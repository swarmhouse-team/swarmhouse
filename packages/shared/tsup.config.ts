import { defineConfig } from 'tsup';

// dist чистится только в `build` (флаг --clean). В dev (nodemon → tsup, см. nodemon.json)
// не чистим: api и web читают dist, пока идёт пересборка. Встроенный `tsup --watch`
// не используем — он следит только за файлами, существовавшими при старте.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
});

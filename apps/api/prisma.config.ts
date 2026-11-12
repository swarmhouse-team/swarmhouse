import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { defineConfig } from 'prisma/config';

// Общий .env лежит в корне монорепозитория. В CI файла может не быть — тогда берём окружение.
const envFile = resolve(__dirname, '../../.env');
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // `prisma generate` работает и без БД, поэтому пустое значение допустимо.
    url: process.env.DATABASE_URL ?? '',
  },
});

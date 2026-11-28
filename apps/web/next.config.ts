import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const webDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(webDir, '../..');

// Общий .env лежит в корне монорепозитория, Next сам читает только apps/web/.env*.
const rootEnvFile = path.join(repoRoot, '.env');
if (existsSync(rootEnvFile)) {
  process.loadEnvFile(rootEnvFile);
}

const apiInternalUrl = process.env.API_INTERNAL_URL ?? 'http://localhost:3001';

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: repoRoot,
  // @robots/ui поставляется исходниками (TSX), его компилирует Next.
  transpilePackages: ['@robots/ui'],
  turbopack: {
    // SVG импортируется как React-компонент: `import Icon from './x.svg'`.
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },
  async rewrites() {
    return [
      // Браузер всегда ходит на свой origin: /api/* проксируется в бэкенд.
      { source: '/api/:path*', destination: `${apiInternalUrl}/api/:path*` },
    ];
  },
};

const withNextIntl = createNextIntlPlugin('./src/shared/i18n/routing/request.ts');

export default withNextIntl(nextConfig);

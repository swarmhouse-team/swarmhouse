import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import type { NextConfig } from 'next';

// Общий .env лежит в корне монорепозитория, Next сам читает только apps/web/.env*.
const rootEnvFile = resolve(process.cwd(), '../../.env');
if (existsSync(rootEnvFile)) {
  process.loadEnvFile(rootEnvFile);
}

const apiInternalUrl = process.env.API_INTERNAL_URL ?? 'http://localhost:3001';

const nextConfig: NextConfig = {
  // @robots/ui поставляется исходниками (TSX), его компилирует Next.
  transpilePackages: ['@robots/ui'],
  async rewrites() {
    return [
      // Браузер всегда ходит на свой origin: /api/* проксируется в бэкенд.
      { source: '/api/:path*', destination: `${apiInternalUrl}/api/:path*` },
    ];
  },
};

export default nextConfig;

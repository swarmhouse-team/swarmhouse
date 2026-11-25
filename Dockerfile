FROM node:22-alpine AS base
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable && corepack prepare pnpm@10.34.9 --activate
WORKDIR /repo

FROM base AS deps
RUN apk add --no-cache libc6-compat
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN pnpm install --frozen-lockfile --ignore-scripts \
  && pnpm rebuild argon2 esbuild prisma sharp @swc/core

FROM deps AS shared-build
COPY . .
RUN pnpm --filter @robots/shared build

FROM shared-build AS api-build
RUN pnpm --filter @robots/api exec prisma generate \
  && pnpm --filter @robots/api build \
  && (cd apps/api && test -d src/generated && \
    find src/generated -type f ! -name '*.ts' ! -name '*.map' | while IFS= read -r file; do \
      rel="${file#src/}"; \
      mkdir -p "dist/$(dirname "$rel")" && cp "$file" "dist/$rel" || exit 1; \
    done)

RUN pnpm --filter @robots/api deploy --prod --legacy --ignore-scripts /opt/api \
  && rm -rf /opt/api/src /opt/api/test \
  && if [ -f apps/api/prisma/rollback-allow ]; then test -f /opt/api/prisma/rollback-allow; fi

FROM shared-build AS web-build
ARG API_INTERNAL_URL=http://api:3001
ENV API_INTERNAL_URL=$API_INTERNAL_URL
RUN pnpm --filter @robots/web build \
  && test -f apps/web/.next/standalone/apps/web/server.js \
  && mkdir -p apps/web/.next/standalone/apps/web/.next \
  && cp -a apps/web/.next/static apps/web/.next/standalone/apps/web/.next/static \
  && if [ -d apps/web/public ]; then \
    mkdir -p apps/web/.next/standalone/apps/web/public \
    && cp -a apps/web/public/. apps/web/.next/standalone/apps/web/public/; \
  fi \
  && node <<'EOF'
const fs = require('fs');
const base = process.env.API_INTERNAL_URL.replace(/\/$/, '');
const expected = base + '/api/:path*';
const manifest = JSON.parse(fs.readFileSync('apps/web/.next/routes-manifest.json', 'utf8'));
const groups = manifest.rewrites || {};
const rewrites = [].concat(groups.beforeFiles || [], groups.afterFiles || [], groups.fallback || []);
const hit = rewrites.find((item) => item && item.source === '/api/:path*');
const actual = hit ? hit.destination : 'missing';
if (actual !== expected || String(actual).includes('localhost')) {
  console.error('rewrite /api/:path* destination mismatch');
  console.error('expected ' + expected);
  console.error('actual ' + actual);
  process.exit(1);
}
console.log('rewrite /api/:path* -> ' + actual);
EOF

FROM node:22-alpine AS api
RUN apk add --no-cache libc6-compat
COPY --from=api-build /opt/api /opt/api
WORKDIR /opt/api
ENV PATH="/opt/api/node_modules/.bin:${PATH}"
ENV HOME=/home/node
RUN mkdir -p node_modules/.bin \
  && printf '%s\n' '#!/bin/sh' 'exec node /opt/api/node_modules/prisma/build/index.js "$@"' > node_modules/.bin/prisma \
  && chmod 755 node_modules/.bin/prisma \
  && chown -R node:node node_modules/.pnpm/@prisma+engines@* prisma
USER node
RUN test -f dist/main.js \
  && test -f prisma.config.ts \
  && test -d prisma/migrations \
  && test ! -d src \
  && test ! -f prisma/seed.ts \
  && test ! -f .env \
  && node -e "require('argon2'); require('@robots/shared');" \
  && DATABASE_URL=postgresql://user:pass@127.0.0.1:5432/db prisma validate \
  && prisma --version
CMD ["node", "dist/main.js"]

FROM node:22-alpine AS web
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY --from=web-build /repo/apps/web/.next/standalone /app
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV HOME=/home/node
USER node
CMD ["node", "apps/web/server.js"]

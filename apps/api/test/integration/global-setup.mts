import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertTestDatabaseUrl } from './support/assert-test-database-url.js';

const here = dirname(fileURLToPath(import.meta.url));
const apiRoot = resolve(here, '../../');
const rootEnv = resolve(apiRoot, '../../.env');

/**
 * Loads the repo `.env` only for variables that are not already set.
 * `process.loadEnvFile` keeps an explicit environment, matching `prisma.config.ts`.
 * The child `DATABASE_URL` is the checked test URL, so that file cannot switch it back.
 *
 * This file is an ES module: the API package compiles `.ts` sources as CommonJS.
 */
export default async function setup(): Promise<void> {
  if (existsSync(rootEnv)) {
    process.loadEnvFile(rootEnv);
  }

  const databaseUrl = assertTestDatabaseUrl(
    process.env.TEST_DATABASE_URL,
    process.env.DATABASE_URL,
  );
  await deployMigrations(databaseUrl);
}

function deployMigrations(databaseUrl: string): Promise<void> {
  const prismaEntry = createRequire(import.meta.url).resolve('prisma/build/index.js');
  return new Promise((resolveSetup, reject) => {
    const child = spawn(process.execPath, [prismaEntry, 'migrate', 'deploy'], {
      cwd: apiRoot,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    });
    const write = (chunk: Buffer) => {
      process.stderr.write(chunk.toString().replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted]'));
    };
    child.stdout?.on('data', write);
    child.stderr?.on('data', write);
    child.on('error', () => {
      reject(new Error('Failed to start prisma migrate deploy'));
    });
    child.on('exit', (code) => {
      if (code === 0) {
        resolveSetup();
        return;
      }
      reject(new Error(`prisma migrate deploy exited with code ${code ?? 'null'}`));
    });
  });
}

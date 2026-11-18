const POSTGRES_PROTOCOL = new Set(['postgresql:', 'postgres:']);
const DEFAULT_PORT = 5432;
const TARGET_OVERRIDE_PARAMS = new Set(['host', 'port', 'dbname', 'database', 'hostaddr']);

interface DatabaseTarget {
  hostname: string;
  port: number;
  database: string;
}

/**
 * Checks that a test connection string is a distinct PostgreSQL URL.
 * The arguments are explicit: this function does not read the environment.
 * It does not resolve DNS, so aliases of one server can still look different.
 */
export function assertTestDatabaseUrl(
  testDatabaseUrl: string | undefined,
  databaseUrl: string | undefined,
): string {
  if (testDatabaseUrl === undefined) {
    throw new Error('TEST_DATABASE_URL is required');
  }
  if (testDatabaseUrl === '') {
    throw new Error('TEST_DATABASE_URL must not be empty');
  }

  const testTarget = parseTarget(testDatabaseUrl, 'TEST_DATABASE_URL');
  if (!testTarget.database.endsWith('_test')) {
    throw new Error('TEST_DATABASE_URL database name must end with _test');
  }
  if (databaseUrl === undefined) {
    return testDatabaseUrl;
  }
  if (databaseUrl === '') {
    throw new Error('DATABASE_URL must not be empty');
  }
  if (databaseUrl === testDatabaseUrl) {
    throw new Error('TEST_DATABASE_URL must not be the same URL as DATABASE_URL');
  }

  const mainTarget = parseTarget(databaseUrl, 'DATABASE_URL');
  if (
    mainTarget.hostname === testTarget.hostname &&
    mainTarget.port === testTarget.port &&
    mainTarget.database === testTarget.database
  ) {
    throw new Error('TEST_DATABASE_URL must not point at the same database as DATABASE_URL');
  }

  return testDatabaseUrl;
}

function parseTarget(value: string, label: string): DatabaseTarget {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} is not a valid URL`);
  }
  if (!POSTGRES_PROTOCOL.has(url.protocol)) {
    throw new Error(`${label} must use the postgresql protocol`);
  }
  if (url.hostname === '' || url.hostname.includes('/')) {
    throw new Error(`${label} must include a host`);
  }
  for (const key of url.searchParams.keys()) {
    if (TARGET_OVERRIDE_PARAMS.has(key.toLowerCase())) {
      throw new Error(`${label} must not override the connection target in query parameters`);
    }
  }

  const port = url.port === '' ? DEFAULT_PORT : Number(url.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${label} has an invalid port`);
  }

  return { hostname: url.hostname, port, database: databaseName(url.pathname, label) };
}

function databaseName(pathname: string, label: string): string {
  const segments = pathname.split('/').filter((segment) => segment !== '');
  const encoded = segments[0];
  if (segments.length !== 1 || encoded === undefined) {
    throw new Error(`${label} must include a database name`);
  }
  try {
    return decodeURIComponent(encoded);
  } catch {
    throw new Error(`${label} has an invalid database name`);
  }
}

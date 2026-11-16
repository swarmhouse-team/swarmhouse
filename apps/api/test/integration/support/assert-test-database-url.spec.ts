import { describe, expect, it } from 'vitest';

import { assertTestDatabaseUrl } from './assert-test-database-url';

const testUrl = 'postgresql://leak-user:s3cret-password@127.0.0.1:5433/robots_test';
const mainUrl = 'postgresql://leak-user:s3cret-password@127.0.0.1:5432/robots';

function messageOf(run: () => void): string {
  try {
    run();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error('expected a failure');
}

describe('assertTestDatabaseUrl', () => {
  it('requires TEST_DATABASE_URL', () => {
    expect(() => assertTestDatabaseUrl(undefined, mainUrl)).toThrow(
      'TEST_DATABASE_URL is required',
    );
  });

  it('rejects an empty TEST_DATABASE_URL', () => {
    expect(() => assertTestDatabaseUrl('', mainUrl)).toThrow('TEST_DATABASE_URL must not be empty');
  });

  it.each(['not a url', 'http://127.0.0.1:5433/robots_test', 'postgresql://:5433/robots_test'])(
    'rejects %j',
    (value) => {
      expect(() => assertTestDatabaseUrl(value, undefined)).toThrow(/^TEST_DATABASE_URL /);
    },
  );

  it('rejects a missing database name', () => {
    expect(() => assertTestDatabaseUrl('postgresql://127.0.0.1:5433', undefined)).toThrow(
      'TEST_DATABASE_URL must include a database name',
    );
  });

  it('rejects a database name that does not end with _test', () => {
    expect(() => assertTestDatabaseUrl('postgresql://127.0.0.1:5433/robots', undefined)).toThrow(
      'database name must end with _test',
    );
  });

  it('rejects identical URLs', () => {
    const url = 'postgresql://127.0.0.1:5433/robots_test';

    expect(() => assertTestDatabaseUrl(url, url)).toThrow('must not be the same URL');
  });

  it.each([
    {
      testDatabaseUrl: 'postgresql://127.0.0.1:5433/robots_test',
      databaseUrl: 'postgresql://other-user:other-secret@127.0.0.1:5433/robots_test',
    },
    {
      testDatabaseUrl: 'postgresql://127.0.0.1:5433/robots_test',
      databaseUrl: 'postgresql://127.0.0.1:5433/robots_test?schema=public',
    },
    {
      testDatabaseUrl: 'postgresql://127.0.0.1:5433/robots_test',
      databaseUrl: 'postgres://127.0.0.1:5433/robots_test',
    },
    {
      testDatabaseUrl: 'postgresql://127.0.0.1/robots_test',
      databaseUrl: 'postgresql://127.0.0.1:5432/robots_test',
    },
  ])('rejects the same target for $databaseUrl', ({ testDatabaseUrl, databaseUrl }) => {
    expect(() => assertTestDatabaseUrl(testDatabaseUrl, databaseUrl)).toThrow(
      'must not point at the same database',
    );
  });

  it('rejects an invalid DATABASE_URL instead of skipping the comparison', () => {
    expect(() => assertTestDatabaseUrl(testUrl, 'not a url')).toThrow(/^DATABASE_URL /);
  });

  it.each([
    'postgresql://127.0.0.1:5433/robots_test?host=127.0.0.1',
    'postgresql://127.0.0.1:5433/robots_test?port=5432',
    'postgresql://127.0.0.1:5433/robots_test?dbname=robots',
    'postgresql:///robots_test',
  ])('rejects a target override %j', (value) => {
    expect(() => assertTestDatabaseUrl(value, undefined)).toThrow(/^TEST_DATABASE_URL /);
  });

  it('returns a separate test database and keeps checking when DATABASE_URL is absent', () => {
    expect(assertTestDatabaseUrl(testUrl, undefined)).toBe(testUrl);
  });

  it('accepts a test database on another port and does not reveal credentials', () => {
    expect(assertTestDatabaseUrl(testUrl, mainUrl)).toBe(testUrl);

    const revealed = messageOf(() => assertTestDatabaseUrl(testUrl, testUrl));

    expect(revealed).not.toContain('s3cret-password');
    expect(revealed).not.toContain('leak-user');
    expect(revealed).not.toContain('postgresql://');
  });
});

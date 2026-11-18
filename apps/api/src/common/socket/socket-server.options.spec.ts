import { describe, expect, it } from 'vitest';

import { isSocketOriginAllowed, readSocketAllowedOrigins } from './socket-server.options';

describe('socket origins', () => {
  it('denies every origin in production until a list is configured', () => {
    expect(readSocketAllowedOrigins('production', undefined)).toEqual([]);
    expect(readSocketAllowedOrigins('production', '')).toEqual([]);
    expect(readSocketAllowedOrigins('development', undefined)).toEqual([
      'http://localhost:3000',
      'http://localhost:3001',
    ]);
    expect(readSocketAllowedOrigins('test', ' http://allowed.example ')).toEqual([
      'http://allowed.example',
    ]);
  });

  it('rejects a missing origin and does not treat * as a wildcard', () => {
    expect(isSocketOriginAllowed(undefined, ['http://allowed.example'])).toBe(false);
    expect(isSocketOriginAllowed('', ['http://allowed.example'])).toBe(false);
    expect(isSocketOriginAllowed('http://evil.example', ['*'])).toBe(false);
    expect(isSocketOriginAllowed('http://allowed.example', ['http://allowed.example'])).toBe(true);
  });
});

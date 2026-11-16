import { describe, expect, it } from 'vitest';

import { isWarehouseOriginAllowed, readWarehouseSocketOrigins } from './warehouse-socket.options';

describe('warehouse socket origins', () => {
  it('denies every origin in production until a list is configured', () => {
    expect(readWarehouseSocketOrigins('production', undefined)).toEqual([]);
    expect(readWarehouseSocketOrigins('production', '')).toEqual([]);
    expect(readWarehouseSocketOrigins('development', undefined)).toEqual([
      'http://localhost:3000',
      'http://localhost:3001',
    ]);
    expect(readWarehouseSocketOrigins('test', ' http://allowed.example ')).toEqual([
      'http://allowed.example',
    ]);
  });

  it('rejects a missing origin and does not treat * as a wildcard', () => {
    expect(isWarehouseOriginAllowed(undefined, ['http://allowed.example'])).toBe(false);
    expect(isWarehouseOriginAllowed('', ['http://allowed.example'])).toBe(false);
    expect(isWarehouseOriginAllowed('http://evil.example', ['*'])).toBe(false);
    expect(isWarehouseOriginAllowed('http://allowed.example', ['http://allowed.example'])).toBe(
      true,
    );
  });
});

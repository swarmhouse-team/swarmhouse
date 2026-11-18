import { describe, expect, it } from 'vitest';

import { ApplicationError, type ErrorDetails } from './application.error';

class SampleApplicationError extends ApplicationError {
  constructor(details?: ErrorDetails, cause?: Error) {
    super('SAMPLE', 'Sample failed', details, cause);
  }
}

describe('ApplicationError', () => {
  it('copies and freezes details and leaves them undefined when omitted', () => {
    const source = { mapId: 'map-1', found: false, note: 'missing', empty: null };
    const error = new SampleApplicationError(source);

    source.mapId = 'changed';

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ApplicationError);
    expect(error).toBeInstanceOf(SampleApplicationError);
    expect(error.name).toBe('SampleApplicationError');
    expect(error.message).toBe('Sample failed');
    expect(error.code).toBe('SAMPLE');
    expect(error.details).toEqual({ mapId: 'map-1', found: false, note: 'missing', empty: null });
    expect(error.details).not.toBe(source);
    expect(Object.isFrozen(error.details)).toBe(true);

    expect(new SampleApplicationError().details).toBeUndefined();
  });

  it('keeps the original cause and stays without one when it is omitted', () => {
    const cause = new Error('domain failed');
    const error = new SampleApplicationError({ mapId: 'map-1' }, cause);

    expect(error.cause).toBe(cause);
    expect(new SampleApplicationError({ mapId: 'map-1' }).cause).toBeUndefined();
  });
});

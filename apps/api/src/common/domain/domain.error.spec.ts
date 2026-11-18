import { describe, expect, it } from 'vitest';

import { DomainError, type ErrorDetails } from './domain.error';

class SampleDomainError extends DomainError {
  constructor(details?: ErrorDetails) {
    super('SAMPLE', 'Sample failed', details);
  }
}

describe('DomainError', () => {
  it('copies and freezes details and leaves them undefined when omitted', () => {
    const source = { x: 1, ok: true, note: 'cell', empty: null };
    const error = new SampleDomainError(source);

    source.x = 9;

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(DomainError);
    expect(error).toBeInstanceOf(SampleDomainError);
    expect(error.name).toBe('SampleDomainError');
    expect(error.message).toBe('Sample failed');
    expect(error.code).toBe('SAMPLE');
    expect(error.details).toEqual({ x: 1, ok: true, note: 'cell', empty: null });
    expect(error.details).not.toBe(source);
    expect(Object.isFrozen(error.details)).toBe(true);
    expect(typeof error.stack).toBe('string');
    expect(error.stack?.length).toBeGreaterThan(0);

    expect(new SampleDomainError().details).toBeUndefined();
  });
});

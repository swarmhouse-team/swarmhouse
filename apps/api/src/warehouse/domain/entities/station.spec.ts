import { describe, expect, it } from 'vitest';

import { StationType } from '../enums/station-type';
import { InvalidIdError, InvalidNameError } from '../errors/value.errors';
import { Position } from '../vo/position';
import { Station } from './station';

describe('Station', () => {
  const position = Position.create(0, 0);

  it('keeps id, name, type, and position', () => {
    const station = Station.create('st-1', ' Receiving ', StationType.Receiving, position);

    expect(station.id).toBe('st-1');
    expect(station.name.value).toBe('Receiving');
    expect(station.type).toBe(StationType.Receiving);
    expect(station.position).toBe(position);
    expect(Object.isFrozen(station)).toBe(true);
  });

  it.each(['', '   ', ' st'])('rejects id %j', (id) => {
    expect(() => Station.create(id, 'Receiving', StationType.Receiving, position)).toThrow(
      InvalidIdError,
    );
  });

  it('rejects an empty name', () => {
    expect(() => Station.create('st-1', ' ', StationType.Issuing, position)).toThrow(
      InvalidNameError,
    );
  });
});

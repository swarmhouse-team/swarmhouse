import { describe, expect, it } from 'vitest';

import { InvalidIdError, InvalidNameError } from '../errors/value.errors';
import { Position } from '../vo/position';
import { Station } from './station';

const STATION_ID = '44444444-4444-4111-8111-44444444444e';

describe('Station', () => {
  const position = Position.create(0, 0);

  it('keeps id, name, and position', () => {
    const station = Station.create(STATION_ID.toUpperCase(), ' Receiving ', position);

    expect(station.id).toBe(STATION_ID);
    expect(station.name.value).toBe('Receiving');
    expect(station.position).toBe(position);
    expect(Object.isFrozen(station)).toBe(true);
  });

  it.each(['', '   ', ' st'])('rejects id %j', (id) => {
    expect(() => Station.create(id, 'Receiving', position)).toThrow(InvalidIdError);
  });

  it('rejects an empty name', () => {
    expect(() => Station.create(STATION_ID, ' ', position)).toThrow(InvalidNameError);
  });
});

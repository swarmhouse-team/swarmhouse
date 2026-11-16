import { Logger } from '@nestjs/common';
import type {
  ArgumentsHost,
  ContextType,
  HttpArgumentsHost,
  RpcArgumentsHost,
  WsArgumentsHost,
} from '@nestjs/common/interfaces';
import { apiErrorSchema, mapVersionConflictErrorSchema } from '@robots/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApplicationError } from '../../application/errors/application.error';
import {
  CorruptedMapStateError,
  MapVersionConflictError,
  WarehouseMapNotFoundError,
  WarehouseNotFoundError,
} from '../../application/errors/application.errors';
import { DomainError } from '../../domain/errors/domain.error';
import {
  CellOccupiedError,
  DuplicateObjectIdError,
  DuplicateStationNameError,
  MapObjectNotFoundError,
  PositionOutOfBoundsError,
} from '../../domain/errors/map.errors';
import {
  InvalidGridSizeError,
  InvalidIdError,
  InvalidNameError,
  InvalidPositionError,
} from '../../domain/errors/value.errors';
import { WarehouseHttpExceptionFilter } from './warehouse-http-exception.filter';

const WAREHOUSE_ID = '11111111-1111-4111-8111-11111111111a';
const MAP_ID = '22222222-2222-7111-8111-22222222222b';

class CapturedResponse {
  statusCode = 0;
  body: unknown;

  status(code: number): this {
    this.statusCode = code;
    return this;
  }

  json(body: unknown): this {
    this.body = body;
    return this;
  }
}

class HttpHost implements ArgumentsHost {
  constructor(private readonly response: CapturedResponse) {}

  getArgs<T extends unknown[] = unknown[]>(): T {
    const args: unknown = [];
    return args as T;
  }

  getArgByIndex<T>(_index: number): T {
    const value: unknown = undefined;
    return value as T;
  }

  switchToRpc(): RpcArgumentsHost {
    throw new Error('RPC is not used');
  }

  switchToWs(): WsArgumentsHost {
    throw new Error('WebSocket is not used');
  }

  getType<TContext extends string = ContextType>(): TContext {
    const context: unknown = 'http';
    return context as TContext;
  }

  switchToHttp(): HttpArgumentsHost {
    const response: unknown = this.response;
    const empty: unknown = undefined;
    return {
      getRequest: <T>() => empty as T,
      getResponse: <T>() => response as T,
      getNext: <T>() => empty as T,
    };
  }
}

class UnexpectedWarehouseError extends ApplicationError {
  constructor() {
    super('WAREHOUSE_NOT_FOUND', 'postgres://user:secret@db', { warehouseId: WAREHOUSE_ID });
  }
}

function handled(exception: ApplicationError | DomainError): CapturedResponse {
  const response = new CapturedResponse();
  new WarehouseHttpExceptionFilter().catch(exception, new HttpHost(response));
  return response;
}

describe('WarehouseHttpExceptionFilter', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('склад не найден → 404 WAREHOUSE_NOT_FOUND', () => {
    const log = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const response = handled(new WarehouseNotFoundError({ warehouseId: WAREHOUSE_ID }));

    expect(response.statusCode).toBe(404);
    expect(response.body).toEqual({
      code: 'WAREHOUSE_NOT_FOUND',
      message: 'Warehouse was not found',
    });
    expect(apiErrorSchema.parse(response.body)).toEqual(response.body);
    expect(JSON.stringify(response.body)).not.toContain(WAREHOUSE_ID);
    expect(log).not.toHaveBeenCalled();
  });

  it('карта не найдена → 404 MAP_NOT_FOUND', () => {
    const response = handled(new WarehouseMapNotFoundError({ mapId: MAP_ID }));

    expect(response.statusCode).toBe(404);
    expect(response.body).toEqual({
      code: 'MAP_NOT_FOUND',
      message: 'Warehouse map was not found',
    });
    expect(apiErrorSchema.parse(response.body)).toEqual(response.body);
    expect(JSON.stringify(response.body)).not.toContain(MAP_ID);
  });

  it('конфликт версии → 409 без версий и внутренних details', () => {
    const log = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const response = handled(
      new MapVersionConflictError({ mapId: MAP_ID, expectedVersion: 1, actualVersion: 4 }),
    );

    expect(response.statusCode).toBe(409);
    expect(response.body).toEqual({
      code: 'MAP_VERSION_CONFLICT',
      message: 'Версия карты устарела. Перечитайте карту и повторите команду.',
    });
    expect(mapVersionConflictErrorSchema.parse(response.body)).toEqual(response.body);
    expect(apiErrorSchema.parse(response.body)).toEqual(response.body);
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain('expectedVersion');
    expect(serialized).not.toContain('actualVersion');
    expect(serialized).not.toContain(MAP_ID);
    expect(log).not.toHaveBeenCalled();
  });

  it.each([
    {
      error: new InvalidIdError('wh-1'),
      code: 'INVALID_ID',
      message: 'Invalid id',
      hidden: 'wh-1',
    },
    {
      error: new InvalidPositionError(1.5, -1),
      code: 'INVALID_POSITION',
      message: 'Invalid position',
      hidden: '1.5',
    },
    {
      error: new InvalidGridSizeError(0, 20),
      code: 'INVALID_GRID_SIZE',
      message: 'Invalid grid size',
      hidden: '"width"',
    },
    {
      error: new InvalidNameError('   '),
      code: 'INVALID_NAME',
      message: 'Invalid name',
      hidden: '"value"',
    },
    {
      error: new PositionOutOfBoundsError(20, 0),
      code: 'POSITION_OUT_OF_BOUNDS',
      message: 'Position is outside the map',
      hidden: '"x"',
    },
    {
      error: new CellOccupiedError(2, 3),
      code: 'CELL_OCCUPIED',
      message: 'Cell is occupied',
      hidden: '"y"',
    },
    {
      error: new DuplicateObjectIdError(MAP_ID),
      code: 'DUPLICATE_OBJECT_ID',
      message: 'Object id is already used',
      hidden: MAP_ID,
    },
    {
      error: new DuplicateStationNameError('dock'),
      code: 'DUPLICATE_STATION_NAME',
      message: 'Station name is already used',
      hidden: 'dock',
    },
    {
      error: new MapObjectNotFoundError('robot'),
      code: 'MAP_OBJECT_NOT_FOUND',
      message: 'Map object was not found',
      hidden: 'robot',
    },
  ])('$code → 422 без внутренних details', ({ error, code, message, hidden }) => {
    const log = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const response = handled(error);

    expect(response.statusCode).toBe(422);
    expect(response.body).toEqual({ code, message });
    expect(apiErrorSchema.parse(response.body)).toEqual(response.body);
    expect(JSON.stringify(response.body)).not.toContain(hidden);
    expect(log).not.toHaveBeenCalled();
  });

  it('повреждённая карта → 500 без mapId, reason, cause и stack', () => {
    const log = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const cause = new Error('postgres://user:secret@db');
    const response = handled(new CorruptedMapStateError(MAP_ID, 'INVALID_STORED_FORMAT', cause));

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    });
    expect(apiErrorSchema.parse(response.body)).toEqual(response.body);
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain(MAP_ID);
    expect(serialized).not.toContain('INVALID_STORED_FORMAT');
    expect(serialized).not.toContain('secret');
    expect(serialized).not.toContain('stack');
    expect(log).toHaveBeenCalledTimes(1);
    const logged = String(log.mock.calls[0]?.[0]);
    expect(logged).toContain(MAP_ID);
    expect(logged).toContain('INVALID_STORED_FORMAT');
    expect(logged).not.toContain('secret');
  });

  it('неизвестная ApplicationError → 500 без исходного сообщения', () => {
    const log = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const response = handled(new UnexpectedWarehouseError());

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    });
    expect(apiErrorSchema.parse(response.body)).toEqual(response.body);
    expect(JSON.stringify(response.body)).not.toContain('secret');
    expect(JSON.stringify(response.body)).not.toContain(WAREHOUSE_ID);
    expect(log).toHaveBeenCalledWith('postgres://user:secret@db', expect.any(String));
  });
});

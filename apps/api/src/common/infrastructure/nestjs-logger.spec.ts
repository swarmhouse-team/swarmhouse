import { Logger } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { NestjsLogger } from './nestjs-logger';

describe('NestjsLogger', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('forwards info to NestJS log with a structured payload', () => {
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const logger = new NestjsLogger('WarehouseApplication');

    logger.info('warehouse.created', { warehouseId: 'wh-1', mapId: 'map-1', version: 0 });

    expect(log).toHaveBeenCalledWith({
      event: 'warehouse.created',
      warehouseId: 'wh-1',
      mapId: 'map-1',
      version: 0,
    });
  });

  it('forwards debug, warn, and error to the matching NestJS methods', () => {
    const debug = vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const logger = new NestjsLogger('WarehouseApplication');

    logger.debug('warehouse.map.noop', { mapId: 'map-1' });
    logger.warn('unused.warn', { mapId: 'map-1' });
    logger.error('unused.error', { mapId: 'map-1' });

    expect(debug).toHaveBeenCalledWith({ event: 'warehouse.map.noop', mapId: 'map-1' });
    expect(warn).toHaveBeenCalledWith({ event: 'unused.warn', mapId: 'map-1' });
    expect(error).toHaveBeenCalledWith({ event: 'unused.error', mapId: 'map-1' });
  });

  it('does not throw when the underlying NestJS logger fails', () => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {
      throw new Error('logger broken');
    });
    const logger = new NestjsLogger('WarehouseApplication');

    expect(() => logger.info('warehouse.created', { warehouseId: 'wh-1' })).not.toThrow();
  });
});

import { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { ServerOptions } from 'socket.io';

import { warehouseServerOptions } from './warehouse-socket.options';

/** Engine path is `/api/socket.io`. Nest's HTTP prefix does not apply to Socket.IO. */
export class WarehouseIoAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly allowedOrigins: readonly string[],
  ) {
    super(app);
  }

  override createIOServer(port: number, options?: ServerOptions): unknown {
    const socketOptions = warehouseServerOptions(this.allowedOrigins);
    return super.createIOServer(port, {
      ...options,
      path: socketOptions.path,
      maxHttpBufferSize: socketOptions.maxHttpBufferSize,
      cors: socketOptions.cors,
      allowRequest: socketOptions.allowRequest,
    });
  }
}

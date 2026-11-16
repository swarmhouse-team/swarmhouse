import { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { ServerOptions } from 'socket.io';

import { appSocketServerOptions } from './socket-server.options';

/** One Socket.IO server for the process. Namespaces are registered by their Nest gateways. */
export class AppSocketIoAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly allowedOrigins: readonly string[],
  ) {
    super(app);
  }

  override createIOServer(port: number, options?: ServerOptions): unknown {
    const socketOptions = appSocketServerOptions(this.allowedOrigins);
    return super.createIOServer(port, {
      ...options,
      path: socketOptions.path,
      maxHttpBufferSize: socketOptions.maxHttpBufferSize,
      cors: socketOptions.cors,
      allowRequest: socketOptions.allowRequest,
    });
  }
}

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { Express, Request, Response } from 'express';
import { cleanupOpenApiDoc } from 'nestjs-zod';

import { AppModule } from './app.module';
import type { Env } from './config/env';
import { WarehouseIoAdapter } from './warehouse/infrastructure/realtime/warehouse-io.adapter';
import { readWarehouseSocketOrigins } from './warehouse/infrastructure/realtime/warehouse-socket.options';

const GLOBAL_PREFIX = 'api';

async function bootstrap(): Promise<void> {
  // abortOnError: false — при ошибке инициализации (DI и т. п.) Nest бросает исключение,
  // а не завершает процесс сам: все отказы старта проходят через один catch внизу файла.
  const app = await NestFactory.create(AppModule, { abortOnError: false });
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  app.setGlobalPrefix(GLOBAL_PREFIX);
  app.enableShutdownHooks();
  app.useWebSocketAdapter(
    new WarehouseIoAdapter(
      app,
      readWarehouseSocketOrigins(
        config.get('NODE_ENV', { infer: true }),
        process.env.WAREHOUSE_SOCKET_ORIGINS,
      ),
    ),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Robots API')
    .setDescription('Платформа управления роботами на симулируемом складе')
    .setVersion('0.0.0')
    .build();
  const document = cleanupOpenApiDoc(SwaggerModule.createDocument(app, swaggerConfig));
  SwaggerModule.setup(`${GLOBAL_PREFIX}/docs`, app, document);
  const playgroundPath = mountLocalWarehousePlayground(app);

  const port = config.get('API_PORT', { infer: true });
  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`API: http://localhost:${port}/${GLOBAL_PREFIX}`);
  logger.log(`Swagger: http://localhost:${port}/${GLOBAL_PREFIX}/docs`);
  if (playgroundPath) {
    logger.log(`Warehouse playground: http://localhost:${port}${playgroundPath}`);
  }
}

/** Serves a gitignored HTML page. Absent in production and when the file is not on disk. */
function mountLocalWarehousePlayground(app: {
  getHttpAdapter: () => { getInstance: () => Express };
}): string | undefined {
  if (process.env.NODE_ENV === 'production') {
    return undefined;
  }

  const file = join(process.cwd(), 'local', 'warehouse-playground.html');
  if (!existsSync(file)) {
    return undefined;
  }

  const path = `/${GLOBAL_PREFIX}/warehouse-playground`;
  app
    .getHttpAdapter()
    .getInstance()
    .get(path, (_request: Request, response: Response) => {
      response.sendFile(file);
    });
  return path;
}

// Явно завершаемся с кодом 1: не полагаемся на поведение Node по умолчанию для необработанных
// отказов промисов (с --unhandled-rejections=warn процесс выходил бы с кодом 0).
bootstrap().catch((error: unknown) => {
  new Logger('Bootstrap').error(
    'API не запустился',
    error instanceof Error ? error.stack : String(error),
  );
  process.exit(1);
});

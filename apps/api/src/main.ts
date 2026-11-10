import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';

import { AppModule } from './app.module';
import type { Env } from './config/env';

const GLOBAL_PREFIX = 'api';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  app.setGlobalPrefix(GLOBAL_PREFIX);
  app.enableShutdownHooks();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Robots API')
    .setDescription('Платформа управления роботами на симулируемом складе')
    .setVersion('0.0.0')
    .build();
  const document = cleanupOpenApiDoc(SwaggerModule.createDocument(app, swaggerConfig));
  SwaggerModule.setup(`${GLOBAL_PREFIX}/docs`, app, document);

  const port = config.get('API_PORT', { infer: true });
  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`API: http://localhost:${port}/${GLOBAL_PREFIX}`);
  logger.log(`Swagger: http://localhost:${port}/${GLOBAL_PREFIX}/docs`);
}

void bootstrap();

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { httpProviders } from './common/http/http.providers';
import { validateEnv } from './config/env';
import { ExampleModule } from './example/example.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // Скрипты запускаются из apps/api, общий .env лежит в корне монорепозитория.
      envFilePath: ['.env', '../../.env'],
      validate: validateEnv,
    }),
    PrismaModule,
    HealthModule,
    ExampleModule,
  ],
  providers: [...httpProviders],
})
export class AppModule {}

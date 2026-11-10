import { Controller, Get, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { healthResponseSchema, type HealthResponse } from '@robots/shared';
import { createZodDto } from 'nestjs-zod';

import { PrismaService } from '../prisma/prisma.service';

class HealthResponseDto extends createZodDto(healthResponseSchema) {}

@ApiTags('health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOkResponse({ type: HealthResponseDto })
  @ApiServiceUnavailableResponse({ description: 'База данных недоступна' })
  async check(): Promise<HealthResponse> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      this.logger.error('Проверка БД не прошла', error instanceof Error ? error.stack : error);
      throw new ServiceUnavailableException('Database is unavailable');
    }

    return { status: 'ok', db: 'up' };
  }
}

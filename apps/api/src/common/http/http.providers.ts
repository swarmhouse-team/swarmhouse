import type { Provider } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';

import { ApiExceptionFilter } from './api-exception.filter';

/**
 * Глобальные HTTP-правила приложения: единственный способ валидации (zod-DTO)
 * и единый формат ошибок (`ApiError`).
 */
export const httpProviders: Provider[] = [
  { provide: APP_PIPE, useClass: ZodValidationPipe },
  { provide: APP_FILTER, useClass: ApiExceptionFilter },
];

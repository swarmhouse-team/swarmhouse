import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { WAREHOUSE_HTTP_ERROR_CODES, type ApiError } from '@robots/shared';
import type { Response } from 'express';

import { ApplicationError } from '../../application/errors/application.error';
import {
  CorruptedMapStateError,
  MapVersionConflictError,
  WarehouseMapNotFoundError,
  WarehouseNotFoundError,
} from '../../application/errors/application.errors';
import { DomainError } from '../../domain/errors/domain.error';

const INTERNAL_ERROR_MESSAGE = 'Internal server error';
const MAP_VERSION_CONFLICT_MESSAGE =
  'Версия карты устарела. Перечитайте карту и повторите команду.';

type ErrorResponse = { status: number; body: ApiError };

/** Переводит ошибки склада в `ApiError`. Остальные исключения ему не передаются. */
@Catch(ApplicationError, DomainError)
export class WarehouseHttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(WarehouseHttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const { status, body } = this.toErrorResponse(exception);

    response.status(status).json(body);
  }

  private toErrorResponse(exception: unknown): ErrorResponse {
    if (exception instanceof WarehouseNotFoundError) {
      return this.clientError(
        HttpStatus.NOT_FOUND,
        WAREHOUSE_HTTP_ERROR_CODES.WAREHOUSE_NOT_FOUND,
        exception.message,
      );
    }
    if (exception instanceof WarehouseMapNotFoundError) {
      return this.clientError(
        HttpStatus.NOT_FOUND,
        WAREHOUSE_HTTP_ERROR_CODES.MAP_NOT_FOUND,
        exception.message,
      );
    }
    if (exception instanceof MapVersionConflictError) {
      return this.clientError(
        HttpStatus.CONFLICT,
        WAREHOUSE_HTTP_ERROR_CODES.MAP_VERSION_CONFLICT,
        MAP_VERSION_CONFLICT_MESSAGE,
      );
    }
    if (exception instanceof CorruptedMapStateError) {
      return this.internalFailure(this.corruptedMessage(exception));
    }
    if (exception instanceof DomainError) {
      return this.clientError(HttpStatus.UNPROCESSABLE_ENTITY, exception.code, exception.message);
    }
    if (exception instanceof ApplicationError) {
      this.logger.error(exception.message, exception.stack);
      return this.internalFailure();
    }

    this.logger.error('Unhandled warehouse exception', String(exception));
    return this.internalFailure();
  }

  private clientError(status: number, code: string, message: string): ErrorResponse {
    return { status, body: { code, message } };
  }

  private internalFailure(logMessage?: string): ErrorResponse {
    if (logMessage !== undefined) {
      this.logger.error(logMessage);
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        code: WAREHOUSE_HTTP_ERROR_CODES.INTERNAL_ERROR,
        message: INTERNAL_ERROR_MESSAGE,
      },
    };
  }

  private corruptedMessage(exception: CorruptedMapStateError): string {
    const mapId = exception.details?.mapId;
    const reason = exception.details?.reason;

    return `Stored warehouse map is corrupted: mapId=${
      typeof mapId === 'string' ? mapId : 'unknown'
    } reason=${typeof reason === 'string' ? reason : 'unknown'}`;
  }
}

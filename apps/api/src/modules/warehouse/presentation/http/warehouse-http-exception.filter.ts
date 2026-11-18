import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Inject } from '@nestjs/common';
import { WAREHOUSE_HTTP_ERROR_CODES, type ApiError } from '@robots/shared';
import type { Response } from 'express';

import { ApplicationError } from '../../../../common/application/application.error';
import { DomainError } from '../../../../common/domain/domain.error';
import {
  CorruptedMapStateError,
  MapVersionConflictError,
  WarehouseMapNotFoundError,
  WarehouseNotFoundError,
} from '../../application/errors/application.errors';
import type { LogContext, LoggerPort } from '../../application/ports/system/logger.port';
import { MAP_VERSION_CONFLICT_PUBLIC_MESSAGE } from '../realtime/warehouse-client-error';
import { NestjsWarehouseLogger } from '../../infrastructure/system/nestjs-warehouse-logger';

const INTERNAL_ERROR_MESSAGE = 'Internal server error';
const MAP_VERSION_CONFLICT_MESSAGE = MAP_VERSION_CONFLICT_PUBLIC_MESSAGE;
const COMPONENT = 'WarehouseHttpExceptionFilter';

type ErrorResponse = { status: number; body: ApiError };

/**
 * Maps warehouse errors to `ApiError`.
 * This filter is the last owner of the errors it catches.
 * It logs only the failures it finishes itself, through `LoggerPort`.
 * The adapter swallows a logging failure, so the HTTP response is still sent.
 * There is no sanitizer for `Error.message` or stack, so those values are not logged.
 */
@Catch(ApplicationError, DomainError)
export class WarehouseHttpExceptionFilter implements ExceptionFilter {
  constructor(@Inject(NestjsWarehouseLogger) private readonly logger: LoggerPort) {}

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
      this.logger.error('warehouse.http.corrupted_map', {
        component: COMPONENT,
        code: WAREHOUSE_HTTP_ERROR_CODES.INTERNAL_ERROR,
        errorClass: exception.name,
        mapId: exception.mapId,
        reason: exception.reason,
      });
      return this.internalFailure();
    }
    if (exception instanceof DomainError) {
      return this.clientError(HttpStatus.UNPROCESSABLE_ENTITY, exception.code, exception.message);
    }
    if (exception instanceof ApplicationError) {
      this.logger.error('warehouse.http.unexpected', this.unexpectedContext(exception.name));
      return this.internalFailure();
    }

    this.logger.error('warehouse.http.unexpected', this.unexpectedContext('UnknownException'));
    return this.internalFailure();
  }

  private clientError(status: number, code: string, message: string): ErrorResponse {
    return { status, body: { code, message } };
  }

  private internalFailure(): ErrorResponse {
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        code: WAREHOUSE_HTTP_ERROR_CODES.INTERNAL_ERROR,
        message: INTERNAL_ERROR_MESSAGE,
      },
    };
  }

  private unexpectedContext(errorClass: string): LogContext {
    return {
      component: COMPONENT,
      code: WAREHOUSE_HTTP_ERROR_CODES.INTERNAL_ERROR,
      errorClass,
    };
  }
}

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { API_ERROR_CODES, type ApiError } from '@robots/shared';
import type { Response } from 'express';
import { ZodValidationException } from 'nestjs-zod';
import { ZodError } from 'zod';

const CODE_BY_STATUS: Partial<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: API_ERROR_CODES.BAD_REQUEST,
  [HttpStatus.UNAUTHORIZED]: API_ERROR_CODES.UNAUTHORIZED,
  [HttpStatus.FORBIDDEN]: API_ERROR_CODES.FORBIDDEN,
  [HttpStatus.NOT_FOUND]: API_ERROR_CODES.NOT_FOUND,
  [HttpStatus.CONFLICT]: API_ERROR_CODES.CONFLICT,
  [HttpStatus.TOO_MANY_REQUESTS]: API_ERROR_CODES.TOO_MANY_REQUESTS,
  [HttpStatus.SERVICE_UNAVAILABLE]: API_ERROR_CODES.SERVICE_UNAVAILABLE,
  [HttpStatus.INTERNAL_SERVER_ERROR]: API_ERROR_CODES.INTERNAL_ERROR,
};

type ErrorResponse = { status: number; body: ApiError };

/** Приводит любую ошибку HTTP-запроса к формату `ApiError`. */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const { status, body } = this.toErrorResponse(exception);

    response.status(status).json(body);
  }

  private toErrorResponse(exception: unknown): ErrorResponse {
    if (exception instanceof ZodValidationException) {
      return this.fromValidation(exception);
    }
    if (exception instanceof HttpException) {
      return this.fromHttpException(exception);
    }

    // Непредвиденная ошибка: подробности только в лог, клиенту — ничего лишнего.
    this.logger.error(
      exception instanceof Error ? exception.message : 'Unhandled exception',
      exception instanceof Error ? exception.stack : String(exception),
    );

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: { code: API_ERROR_CODES.INTERNAL_ERROR, message: 'Internal server error' },
    };
  }

  private fromValidation(exception: ZodValidationException): ErrorResponse {
    const zodError = exception.getZodError();
    const issues = zodError instanceof ZodError ? zodError.issues : [];

    return {
      status: HttpStatus.BAD_REQUEST,
      body: {
        code: API_ERROR_CODES.VALIDATION_ERROR,
        message: 'Validation failed',
        details: issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
    };
  }

  private fromHttpException(exception: HttpException): ErrorResponse {
    const status = exception.getStatus();

    if (status >= 500) {
      this.logger.error(exception.message, exception.stack);
    }

    return {
      status,
      body: {
        code: CODE_BY_STATUS[status] ?? HttpStatus[status] ?? API_ERROR_CODES.INTERNAL_ERROR,
        message: extractMessage(exception),
      },
    };
  }
}

function extractMessage(exception: HttpException): string {
  const response = exception.getResponse();

  if (typeof response === 'string') {
    return response;
  }

  const message = (response as { message?: unknown }).message;
  if (typeof message === 'string') {
    return message;
  }
  if (Array.isArray(message)) {
    return message.join('; ');
  }

  return exception.message;
}

import { HttpStatus } from '@nestjs/common';
import { API_ERROR_CODES, type ApiError } from '@robots/shared';
import { ZodValidationException } from 'nestjs-zod';
import { ZodError, type ZodIssue } from 'zod';

import { ApplicationError } from '../application/application.error';
import { DomainError } from '../domain/domain.error';

const INTERNAL_MESSAGE = 'Internal server error';

export type ThrownErrorMapping = {
  status: number;
  body: ApiError;
  log?: Readonly<Record<string, string | number | boolean | null>>;
};

/** Maps Zod, application, and domain errors to the public `ApiError` body. */
export function mapThrownError(error: unknown): ThrownErrorMapping | undefined {
  if (error instanceof ZodValidationException) {
    const zodError = error.getZodError();
    const issues = zodError instanceof ZodError ? zodError.issues : [];
    return validation(issues);
  }
  if (error instanceof ZodError) {
    return validation(error.issues);
  }
  if (error instanceof DomainError) {
    return {
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      body: { code: error.code, message: error.message },
    };
  }
  if (error instanceof ApplicationError) {
    if (error.clientStatus !== undefined) {
      return {
        status: error.clientStatus,
        body: { code: error.code, message: error.clientMessage ?? error.message },
      };
    }
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: { code: API_ERROR_CODES.INTERNAL_ERROR, message: INTERNAL_MESSAGE },
      log: { errorClass: error.name, ...error.logFields },
    };
  }
  return undefined;
}

function validation(issues: readonly ZodIssue[]): ThrownErrorMapping {
  return {
    status: HttpStatus.BAD_REQUEST,
    body: {
      code: API_ERROR_CODES.VALIDATION_ERROR,
      message: 'Validation failed',
      details: issues.map((issue) => ({
        path: issue.path.join('.'),
        code: issue.code,
        message: issue.message,
      })),
    },
  };
}

import { API_ERROR_CODES, WAREHOUSE_HTTP_ERROR_CODES, type ApiError } from '@robots/shared';
import { ZodError } from 'zod';

import { ApplicationError } from '../../../../common/application/application.error';
import { DomainError } from '../../../../common/domain/domain.error';
import {
  MapVersionConflictError,
  WarehouseMapNotFoundError,
  WarehouseNotFoundError,
} from '../../application/errors/application.errors';

export const MAP_VERSION_CONFLICT_PUBLIC_MESSAGE =
  'The map version is stale. Read the map again and repeat the command.';

const INTERNAL_MESSAGE = 'Internal server error';

export function zodErrorToApiError(error: ZodError): ApiError {
  return {
    code: API_ERROR_CODES.VALIDATION_ERROR,
    message: 'Validation failed',
    details: error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    })),
  };
}

/** Public socket error. Domain details, versions, stacks, and SQL stay off the ack. */
export function toWarehouseApiError(error: unknown): ApiError {
  if (error instanceof ZodError) {
    return zodErrorToApiError(error);
  }
  if (error instanceof WarehouseNotFoundError) {
    return { code: WAREHOUSE_HTTP_ERROR_CODES.WAREHOUSE_NOT_FOUND, message: error.message };
  }
  if (error instanceof WarehouseMapNotFoundError) {
    return { code: WAREHOUSE_HTTP_ERROR_CODES.MAP_NOT_FOUND, message: error.message };
  }
  if (error instanceof MapVersionConflictError) {
    return {
      code: WAREHOUSE_HTTP_ERROR_CODES.MAP_VERSION_CONFLICT,
      message: MAP_VERSION_CONFLICT_PUBLIC_MESSAGE,
    };
  }
  if (error instanceof DomainError) {
    return { code: error.code, message: error.message };
  }
  if (error instanceof ApplicationError) {
    return { code: API_ERROR_CODES.INTERNAL_ERROR, message: INTERNAL_MESSAGE };
  }
  return { code: API_ERROR_CODES.INTERNAL_ERROR, message: INTERNAL_MESSAGE };
}

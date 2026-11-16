import {
  createWarehouseRequestSchema,
  editWarehouseMapRequestSchema,
  renameWarehouseRequestSchema,
  warehouseMapPathParamsSchema,
  warehousePathParamsSchema,
} from '@robots/shared';
import { createZodDto } from 'nestjs-zod';

/** DTO из shared-схем: валидирует глобальный pipe, отдельной схемы в API нет. */
export class CreateWarehouseDto extends createZodDto(createWarehouseRequestSchema) {}

export class RenameWarehouseDto extends createZodDto(renameWarehouseRequestSchema) {}

export class WarehousePathParamsDto extends createZodDto(warehousePathParamsSchema) {}

export class WarehouseMapPathParamsDto extends createZodDto(warehouseMapPathParamsSchema) {}

export class EditWarehouseMapDto extends createZodDto(editWarehouseMapRequestSchema) {}

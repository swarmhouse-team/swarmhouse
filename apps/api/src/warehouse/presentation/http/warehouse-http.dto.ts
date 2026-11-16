import {
  createWarehouseRequestSchema,
  editWarehouseMapRequestSchema,
  renameWarehouseRequestSchema,
  warehouseMapPathParamsSchema,
  warehousePathParamsSchema,
} from '@robots/shared';
import { createZodDto } from 'nestjs-zod';

/** DTOs from shared schemas. The global pipe validates them; the API has no separate schema. */
export class CreateWarehouseDto extends createZodDto(createWarehouseRequestSchema) {}

export class RenameWarehouseDto extends createZodDto(renameWarehouseRequestSchema) {}

export class WarehousePathParamsDto extends createZodDto(warehousePathParamsSchema) {}

export class WarehouseMapPathParamsDto extends createZodDto(warehouseMapPathParamsSchema) {}

export class EditWarehouseMapDto extends createZodDto(editWarehouseMapRequestSchema) {}

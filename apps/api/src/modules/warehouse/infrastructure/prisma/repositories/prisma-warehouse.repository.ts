import type { PrismaTransaction } from '../../../../../common/infrastructure/prisma-transaction';
import { Warehouse } from '../../../domain/entities/warehouse';
import type {
  DeleteWarehouseResult,
  SaveWarehouseResult,
  StoredWarehouse,
  WarehouseRepository,
} from '../../../application/ports/repositories/warehouse.repository';

export const warehouseListOrder = [
  { createdAt: { sort: 'desc', nulls: 'last' } },
  { id: 'desc' },
] as const;

const warehouseSelect = {
  id: true,
  name: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** Stores warehouse rows. It does not open a transaction or touch maps. */
export class PrismaWarehouseRepository implements WarehouseRepository {
  constructor(private readonly transaction: PrismaTransaction) {}

  async insert(warehouse: Warehouse, recordedAt: Date): Promise<void> {
    await this.transaction.db.warehouseRecord.create({
      data: {
        id: warehouse.id,
        name: warehouse.name.value,
        createdAt: recordedAt,
        updatedAt: recordedAt,
      },
    });
  }

  async findById(warehouseId: string): Promise<StoredWarehouse | null> {
    const row = await this.transaction.db.warehouseRecord.findUnique({
      where: { id: warehouseId },
      select: warehouseSelect,
    });
    return row ? this.toStored(row) : null;
  }

  async save(warehouse: Warehouse, updatedAt: Date): Promise<SaveWarehouseResult> {
    const result = await this.transaction.db.warehouseRecord.updateMany({
      where: { id: warehouse.id },
      data: { name: warehouse.name.value, updatedAt },
    });
    return result.count === 1 ? { status: 'saved' } : { status: 'not_found' };
  }

  async list(): Promise<StoredWarehouse[]> {
    const rows = await this.transaction.db.warehouseRecord.findMany({
      select: warehouseSelect,
      orderBy: [...warehouseListOrder],
    });
    return rows.map((row) => this.toStored(row));
  }

  async delete(warehouseId: string): Promise<DeleteWarehouseResult> {
    const result = await this.transaction.db.warehouseRecord.deleteMany({
      where: { id: warehouseId },
    });
    return result.count === 1 ? { status: 'deleted' } : { status: 'not_found' };
  }

  private toStored(row: {
    id: string;
    name: string;
    createdAt: Date | null;
    updatedAt: Date | null;
  }): StoredWarehouse {
    const warehouse = Warehouse.create(row.id, row.name);
    return {
      id: warehouse.id,
      name: warehouse.name.value,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}

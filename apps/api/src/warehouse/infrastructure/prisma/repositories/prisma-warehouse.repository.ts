import { Warehouse } from '../../../domain/entities/warehouse';
import type {
  DeleteWarehouseResult,
  SaveWarehouseResult,
  StoredWarehouse,
  WarehouseRepository,
} from '../../../application/ports/repositories/warehouse.repository';
import type { PrismaDb } from '../prisma-db';

/** Stores warehouse rows. It does not open a transaction or touch maps. */
export class PrismaWarehouseRepository implements WarehouseRepository {
  constructor(private readonly db: PrismaDb) {}

  async insert(warehouse: Warehouse): Promise<void> {
    await this.db.warehouseRecord.create({
      data: { id: warehouse.id, name: warehouse.name.value },
    });
  }

  async findById(warehouseId: string): Promise<StoredWarehouse | null> {
    const row = await this.db.warehouseRecord.findUnique({
      where: { id: warehouseId },
      select: { id: true, name: true },
    });
    if (!row) {
      return null;
    }
    const warehouse = Warehouse.create(row.id, row.name);
    return { id: warehouse.id, name: warehouse.name.value };
  }

  async save(warehouse: Warehouse): Promise<SaveWarehouseResult> {
    const result = await this.db.warehouseRecord.updateMany({
      where: { id: warehouse.id },
      data: { name: warehouse.name.value },
    });
    return result.count === 1 ? { status: 'saved' } : { status: 'not_found' };
  }

  async delete(warehouseId: string): Promise<DeleteWarehouseResult> {
    const result = await this.db.warehouseRecord.deleteMany({
      where: { id: warehouseId },
    });
    return result.count === 1 ? { status: 'deleted' } : { status: 'not_found' };
  }
}

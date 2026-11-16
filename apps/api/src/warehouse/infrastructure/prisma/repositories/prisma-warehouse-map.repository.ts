import type { Prisma } from '../../../../generated/prisma/client';
import type { WarehouseMap, WarehouseMapSnapshot } from '../../../domain/entities/warehouse-map';
import type {
  SaveMapResult,
  StoredWarehouseMap,
  WarehouseMapRepository,
} from '../../../application/ports/repositories/warehouse-map.repository';
import { parseMapContent } from '../mapping/map-content.schema';
import type { PrismaDb } from '../prisma-db';

/** Stores one map row. It does not restore the aggregate or open a transaction. */
export class PrismaWarehouseMapRepository implements WarehouseMapRepository {
  constructor(private readonly db: PrismaDb) {}

  async insert(map: WarehouseMap): Promise<void> {
    const snapshot = map.snapshot();
    await this.db.warehouseMapRecord.create({
      data: {
        id: snapshot.id,
        warehouseId: snapshot.warehouseId,
        version: 0,
        content: mapContent(snapshot),
      },
    });
  }

  async findById(mapId: string): Promise<StoredWarehouseMap | null> {
    const row = await this.db.warehouseMapRecord.findUnique({
      where: { id: mapId },
    });
    return row ? this.toStored(row) : null;
  }

  async findByWarehouseId(warehouseId: string): Promise<StoredWarehouseMap | null> {
    const row = await this.db.warehouseMapRecord.findUnique({
      where: { warehouseId },
    });
    return row ? this.toStored(row) : null;
  }

  async save(map: WarehouseMap, expectedVersion: number): Promise<SaveMapResult> {
    const snapshot = map.snapshot();
    const updated = await this.db.warehouseMapRecord.updateMany({
      where: { id: snapshot.id, version: expectedVersion },
      data: {
        content: mapContent(snapshot),
        version: { increment: 1 },
      },
    });
    if (updated.count === 1) {
      return { status: 'saved', version: expectedVersion + 1 };
    }

    const current = await this.db.warehouseMapRecord.findUnique({
      where: { id: snapshot.id },
      select: { version: true },
    });
    if (!current) {
      return { status: 'not_found' };
    }
    return { status: 'conflict', actualVersion: current.version };
  }

  async deleteByWarehouseId(warehouseId: string): Promise<void> {
    await this.db.warehouseMapRecord.deleteMany({
      where: { warehouseId },
    });
  }

  private toStored(row: {
    id: string;
    warehouseId: string;
    version: number;
    content: Prisma.JsonValue;
  }): StoredWarehouseMap {
    return {
      snapshot: parseMapContent(row.id, row.warehouseId, row.content),
      version: row.version,
    };
  }
}

function mapContent(snapshot: WarehouseMapSnapshot): Prisma.InputJsonObject {
  return {
    width: snapshot.width,
    height: snapshot.height,
    obstacles: snapshot.obstacles.map((obstacle) => ({ x: obstacle.x, y: obstacle.y })),
    robots: snapshot.robots.map((robot) => ({
      id: robot.id,
      name: robot.name,
      x: robot.x,
      y: robot.y,
    })),
    stations: snapshot.stations.map((station) => ({
      id: station.id,
      name: station.name,
      type: station.type,
      x: station.x,
      y: station.y,
    })),
  };
}

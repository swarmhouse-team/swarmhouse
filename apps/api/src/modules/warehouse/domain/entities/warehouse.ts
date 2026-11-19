import { normalizeId } from '../vo/id';
import { WarehouseName } from '../vo/warehouse-name';

/** Warehouse aggregate root. It validates only its own name and does not know about the map. */
export class Warehouse {
  readonly id: string;
  readonly name: WarehouseName;

  private constructor(id: string, name: WarehouseName) {
    this.id = id;
    this.name = name;
    Object.freeze(this);
  }

  static create(id: string, name: string): Warehouse {
    return new Warehouse(normalizeId(id), WarehouseName.create(name));
  }

  /** Returns a new warehouse with the same id and a name checked by `WarehouseName`. */
  rename(name: string): Warehouse {
    return new Warehouse(this.id, WarehouseName.create(name));
  }
}

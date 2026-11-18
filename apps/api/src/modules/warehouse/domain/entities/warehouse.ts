import { normalizeId } from '../vo/id';
import { Name } from '../vo/name';

/** Warehouse aggregate root. It validates only its own name and does not know about the map. */
export class Warehouse {
  readonly id: string;
  readonly name: Name;

  private constructor(id: string, name: Name) {
    this.id = id;
    this.name = name;
    Object.freeze(this);
  }

  static create(id: string, name: string): Warehouse {
    return new Warehouse(normalizeId(id), Name.create(name));
  }

  /** Returns a new warehouse with the same id and a name checked by `Name`. */
  rename(name: string): Warehouse {
    return new Warehouse(this.id, Name.create(name));
  }
}

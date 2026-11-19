import { normalizeId } from '../vo/id';
import { WarehouseName } from '../vo/warehouse-name';
import { Position } from '../../../../common/domain/position';

/** A station on the map. The instance is immutable: a move creates a new object. */
export class Station {
  readonly id: string;
  readonly name: WarehouseName;
  readonly position: Position;

  private constructor(id: string, name: WarehouseName, position: Position) {
    this.id = id;
    this.name = name;
    this.position = position;
    Object.freeze(this);
  }

  static create(id: string, name: string, position: Position): Station {
    return new Station(normalizeId(id), WarehouseName.create(name), position);
  }

  withPosition(position: Position): Station {
    return new Station(this.id, this.name, position);
  }
}

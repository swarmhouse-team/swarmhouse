import { normalizeId } from '../vo/id';
import { WarehouseName } from '../vo/warehouse-name';
import { Position } from '../../../../common/domain/position';

/** A robot on the map. The instance is immutable: a move creates a new object. */
export class Robot {
  readonly id: string;
  readonly name: WarehouseName;
  readonly position: Position;

  private constructor(id: string, name: WarehouseName, position: Position) {
    this.id = id;
    this.name = name;
    this.position = position;
    Object.freeze(this);
  }

  static create(id: string, name: string, position: Position): Robot {
    return new Robot(normalizeId(id), WarehouseName.create(name), position);
  }

  withPosition(position: Position): Robot {
    return new Robot(this.id, this.name, position);
  }
}

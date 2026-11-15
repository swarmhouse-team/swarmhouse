import type { StationType } from '../enums/station-type';
import { assertId } from '../vo/id';
import { Name } from '../vo/name';
import { Position } from '../vo/position';

/** A station on the map. The instance is immutable: a move creates a new object. */
export class Station {
  readonly id: string;
  readonly name: Name;
  readonly type: StationType;
  readonly position: Position;

  private constructor(id: string, name: Name, type: StationType, position: Position) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.position = position;
    Object.freeze(this);
  }

  static create(id: string, name: string, type: StationType, position: Position): Station {
    return new Station(assertId(id), Name.create(name), type, position);
  }

  withPosition(position: Position): Station {
    return new Station(this.id, this.name, this.type, position);
  }
}

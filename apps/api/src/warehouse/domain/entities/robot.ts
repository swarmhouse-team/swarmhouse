import { assertId } from '../vo/id';
import { Name } from '../vo/name';
import { Position } from '../vo/position';

/** A robot on the map. The instance is immutable: a move creates a new object. */
export class Robot {
  readonly id: string;
  readonly name: Name;
  readonly position: Position;

  private constructor(id: string, name: Name, position: Position) {
    this.id = id;
    this.name = name;
    this.position = position;
    Object.freeze(this);
  }

  static create(id: string, name: string, position: Position): Robot {
    return new Robot(assertId(id), Name.create(name), position);
  }

  withPosition(position: Position): Robot {
    return new Robot(this.id, this.name, position);
  }
}

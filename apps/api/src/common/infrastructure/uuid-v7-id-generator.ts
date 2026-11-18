import { v7 as uuidV7 } from 'uuid';

import type { IdGenerator } from '../application/id-generator';

/** Creates lowercase UUID v7 values. It does not claim global order or uniqueness. */
export class UuidV7IdGenerator implements IdGenerator {
  next(): string {
    return uuidV7().toLowerCase();
  }
}

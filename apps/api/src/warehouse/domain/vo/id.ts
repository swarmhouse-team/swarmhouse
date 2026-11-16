import { InvalidIdError } from '../errors/value.errors';
import { MAX_UUID, NIL_UUID, UUID_TEXT } from '../constants';

/**
 * Checks the shared UUID text form for a warehouse, map, robot, and station.
 * Any version is accepted. Leading or trailing spaces and other broken values
 * are rejected as they are: nothing is trimmed or repaired.
 * The nil and max UUIDs are not identities of real entities.
 * This check does not choose the in-system letter case. Use `normalizeId` for that.
 */
export function assertId(value: string): string {
  if (!UUID_TEXT.test(value)) {
    throw new InvalidIdError(value);
  }

  const canonical = value.toLowerCase();
  if (canonical === NIL_UUID || canonical === MAX_UUID) {
    throw new InvalidIdError(value);
  }

  return value;
}

/** Valid id in the single in-system form: lowercase. The check stays in `assertId`. */
export function normalizeId(value: string): string {
  return assertId(value).toLowerCase();
}

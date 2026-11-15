import { InvalidIdError } from '../errors/value.errors';

/**
 * Checks the shared id format for a warehouse, map, robot, and station.
 * Leading and trailing spaces are rejected rather than trimmed,
 * so "a" and " a" cannot collapse into the same id.
 */
export function assertId(value: string): string {
  if (value.length === 0 || value !== value.trim()) {
    throw new InvalidIdError(value);
  }

  return value;
}

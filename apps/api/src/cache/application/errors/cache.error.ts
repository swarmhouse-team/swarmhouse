export type CacheErrorKind =
  'invalid_key' | 'invalid_ttl' | 'invalid_value' | 'corrupt' | 'unavailable' | 'command_failed';

const MESSAGES: Record<CacheErrorKind, string> = {
  invalid_key: 'Cache key is invalid',
  invalid_ttl: 'Cache TTL is invalid',
  invalid_value: 'Cache value is invalid',
  corrupt: 'Cache value is corrupt',
  unavailable: 'Cache is unavailable',
  command_failed: 'Cache command failed',
};

/** Technical cache failure. The message never includes a URL, credentials, or payload. */
export class CacheError extends Error {
  readonly kind: CacheErrorKind;

  constructor(kind: CacheErrorKind, cause?: unknown) {
    super(MESSAGES[kind], cause === undefined ? undefined : { cause });
    this.name = new.target.name;
    this.kind = kind;
  }
}

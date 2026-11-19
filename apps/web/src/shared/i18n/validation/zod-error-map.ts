import type { useTranslations } from 'next-intl';
import type { z } from 'zod';

/** Переводчик неймспейса `validation`. */
export type ValidationTranslator = ReturnType<typeof useTranslations<'validation'>>;

type SizeKey = 'string' | 'number' | 'numberExclusive' | 'array' | 'other';

function sizeKey(origin: string, inclusive: boolean | undefined): SizeKey {
  switch (origin) {
    case 'string':
      return 'string';
    case 'number':
    case 'int':
    case 'bigint':
      return inclusive === false ? 'numberExclusive' : 'number';
    case 'array':
    case 'set':
      return 'array';
    default:
      return 'other';
  }
}

/**
 * Error map zod 4: сообщение по коду правила на языке переводчика.
 * Передаётся при каждом разборе (`schema.parse(data, { error })`), а не глобально:
 * `z.config()` — синглтон модуля и на сервере общий для запросов на разных языках.
 */
export function createZodErrorMap(t: ValidationTranslator): z.core.$ZodErrorMap {
  return (issue) => {
    switch (issue.code) {
      case 'invalid_type':
        return issue.input === undefined || issue.input === null
          ? t('required')
          : t('invalid_type');
      case 'too_small':
        return t(`too_small.${sizeKey(issue.origin, issue.inclusive)}`, {
          minimum: Number(issue.minimum),
        });
      case 'too_big':
        return t(`too_big.${sizeKey(issue.origin, issue.inclusive)}`, {
          maximum: Number(issue.maximum),
        });
      case 'invalid_format':
        if (issue.format === 'email') {
          return t('invalid_format.email');
        }
        return issue.format === 'url' ? t('invalid_format.url') : t('invalid_format.other');
      case 'invalid_value':
        return t('invalid_value');
      case 'not_multiple_of':
        return t('not_multiple_of', { divisor: Number(issue.divisor) });
      default:
        return t('invalid');
    }
  };
}

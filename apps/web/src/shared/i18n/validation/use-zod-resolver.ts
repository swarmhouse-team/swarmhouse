'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import type { FieldErrors, FieldValues, Resolver } from 'react-hook-form';
import type { z } from 'zod';

import { createZodErrorMap } from './zod-error-map';

type RootTranslator = ReturnType<typeof useTranslations<never>>;

/**
 * Переводит явные сообщения схемы. Явное сообщение (`.min(3, 'validation.x')`) zod ставит
 * выше error map, поэтому договорённость: такое сообщение — ключ словаря.
 */
function translateExplicitMessages(errors: FieldErrors, t: RootTranslator): FieldErrors {
  const translated: Record<string, unknown> = {};

  for (const [name, value] of Object.entries(errors)) {
    if (!value || typeof value !== 'object') {
      translated[name] = value;
      continue;
    }

    const { ref, message, ...rest } = value as Record<string, unknown>;
    // `ref` — DOM-элемент поля, его не обходим и не копируем.
    const nested = translateExplicitMessages(rest as FieldErrors, t);
    const isKey = typeof message === 'string' && t.has(message as never);

    translated[name] = {
      ...nested,
      ...(ref !== undefined && { ref }),
      ...(message !== undefined && { message: isKey ? t(message as never) : message }),
    };
  }

  return translated as FieldErrors;
}

/**
 * `zodResolver` для react-hook-form с сообщениями на текущем языке: правила zod
 * переводятся по коду (`createZodErrorMap`), явные сообщения схемы — как ключи словаря.
 */
export function useZodResolver<Input extends FieldValues, Output>(
  schema: z.ZodType<Output, Input>,
): Resolver<Input, unknown, Output> {
  const tValidation = useTranslations('validation');
  const t = useTranslations();

  return useMemo<Resolver<Input, unknown, Output>>(() => {
    const resolve = zodResolver(schema, { error: createZodErrorMap(tValidation) });

    return async (values, context, options) => {
      const result = await resolve(values, context, options);
      return Object.keys(result.errors).length === 0
        ? result
        : { values: {}, errors: translateExplicitMessages(result.errors, t) as FieldErrors<Input> };
    };
  }, [schema, t, tValidation]);
}

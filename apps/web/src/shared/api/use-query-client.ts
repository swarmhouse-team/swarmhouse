'use client';

import type { QueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { useErrorMessage } from './error-message';
import { createQueryClient } from './query-client';

/**
 * QueryClient на всё время жизни компонента. Тост берёт актуальную функцию перевода
 * в момент ошибки, поэтому при смене языка клиент (и его кеш) не пересоздаётся.
 */
export function useQueryClientWithI18n(): QueryClient {
  const getErrorMessage = useErrorMessage();
  const getErrorMessageRef = useRef(getErrorMessage);

  useEffect(() => {
    getErrorMessageRef.current = getErrorMessage;
  }, [getErrorMessage]);

  const getErrorMessageFromRef = (error: unknown) => getErrorMessageRef.current(error);

  // ref читается только в момент ошибки мутации (в onError), а не во время рендера —
  // в отличие от типичного случая, на который рассчитано правило react-hooks/refs.
  // eslint-disable-next-line react-hooks/refs
  const [queryClient] = useState(() =>
    createQueryClient({ getErrorMessage: getErrorMessageFromRef }),
  );

  return queryClient;
}

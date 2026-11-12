import { toast } from '@robots/ui';
import { MutationCache, QueryClient } from '@tanstack/react-query';

import { getErrorMessage, HttpError } from './http-error';

declare module '@tanstack/react-query' {
  interface Register {
    defaultError: Error;
    mutationMeta: {
      /** Не показывать тост об ошибке: компонент обработает её сам. */
      silent?: boolean;
    };
  }
}

/**
 * Повторяем только то, что может пройти со второй попытки: сеть (0) и сбои сервера (5xx).
 * 4xx и некорректный ответ при 2xx повторятся так же, а ошибка не из `http` — баг в коде.
 */
function isRetryable(error: Error): boolean {
  return error instanceof HttpError && (error.status === 0 || error.status >= 500);
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (failureCount, error) => failureCount < 2 && isRetryable(error),
      },
    },
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        if (mutation.meta?.silent) {
          return;
        }
        toast.error(getErrorMessage(error));
      },
    }),
  });
}

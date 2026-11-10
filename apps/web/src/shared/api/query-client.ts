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

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Ошибки клиента (4xx) повторять бессмысленно.
        retry: (failureCount, error) =>
          !(error instanceof HttpError && error.status >= 400 && error.status < 500) &&
          failureCount < 2,
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

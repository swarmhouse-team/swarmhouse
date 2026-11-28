'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { useQueryClientWithI18n } from '@/shared/api';
import { UiIntlProvider } from '@/shared/i18n';

import { SessionProvider } from './session-provider';

/** Должен рендериться внутри `NextIntlClientProvider`: тосты ошибок берут из него язык. */
export function Providers({ children }: { children: ReactNode }) {
  const queryClient = useQueryClientWithI18n();

  return (
    <UiIntlProvider>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>{children}</SessionProvider>
      </QueryClientProvider>
    </UiIntlProvider>
  );
}

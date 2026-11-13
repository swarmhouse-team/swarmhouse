'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { useQueryClientWithI18n } from '@/shared/api';

/** Должен рендериться внутри `NextIntlClientProvider`: тосты ошибок берут из него язык. */
export function Providers({ children }: { children: ReactNode }) {
  const queryClient = useQueryClientWithI18n();

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

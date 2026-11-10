'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

import { createQueryClient } from '@/shared/api';

export function Providers({ children }: { children: ReactNode }) {
  // Клиент создаётся один раз на жизнь вкладки, а не на каждый рендер.
  const [queryClient] = useState(createQueryClient);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

import { Toaster } from '@robots/ui';
import type { ReactNode } from 'react';

/** Общая обёртка всех страниц. */
export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <Toaster />
    </>
  );
}

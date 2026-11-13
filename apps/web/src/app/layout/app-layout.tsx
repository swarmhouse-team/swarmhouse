import { Toaster } from '@robots/ui';
import type { ReactNode } from 'react';

import { LocaleSwitcher } from '@/features/switch-locale';

/** Общая обёртка всех страниц. */
export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      {/* Пока нет шапки приложения — переключатель языка в углу экрана. */}
      <div className="fixed top-4 right-4">
        <LocaleSwitcher />
      </div>
      <Toaster />
    </>
  );
}

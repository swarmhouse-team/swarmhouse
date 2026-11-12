import '@/app/styles/globals.css';

import { Toaster } from '@robots/ui';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { Providers } from '@/app/providers';

export const metadata: Metadata = {
  title: 'Robots — диспетчерская склада',
  description: 'Платформа управления роботами на симулируемом складе',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body className="min-h-dvh antialiased">
        <Providers>{children}</Providers>
        <Toaster />
      </body>
    </html>
  );
}

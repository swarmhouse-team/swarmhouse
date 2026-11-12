'use client';

import type { CSSProperties } from 'react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

export { toast } from 'sonner';

/** Контейнер тостов. Подключается один раз в корневом layout. */
export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      className="toaster group"
      richColors
      closeButton
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
        } as CSSProperties
      }
      {...props}
    />
  );
}

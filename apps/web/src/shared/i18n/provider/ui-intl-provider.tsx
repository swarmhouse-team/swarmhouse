'use client';

import { UiTextProvider, type UiText } from '@robots/ui';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

type UiIntlProviderProps = {
  children: ReactNode;
};

export function UiIntlProvider({ children }: UiIntlProviderProps) {
  const t = useTranslations('ui');
  const value: UiText = {
    dialog: {
      close: t('dialog.close'),
    },
  };

  return <UiTextProvider value={value}>{children}</UiTextProvider>;
}

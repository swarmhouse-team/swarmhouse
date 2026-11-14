import { QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';

import { useQueryClientWithI18n } from '@/shared/api';
import { LocalIntlProvider, type Locale } from '@/shared/i18n';

type RenderWithProvidersOptions = Omit<RenderOptions, 'wrapper'> & {
  /** Язык интерфейса, по умолчанию `ru`. */
  locale?: Locale;
};

/**
 * Рендер компонента со всеми провайдерами приложения: словари next-intl и свой QueryClient.
 * Только для тестов (*.spec.tsx).
 */
export function renderWithProviders(
  ui: ReactElement,
  { locale, ...options }: RenderWithProvidersOptions = {},
) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <LocalIntlProvider locale={locale} timeZone="UTC">
        <QueryProvider>{children}</QueryProvider>
      </LocalIntlProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...options });
}

/** Как в приложении: QueryClient с тостами на текущем языке, новый на каждый рендер теста. */
function QueryProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClientWithI18n();
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

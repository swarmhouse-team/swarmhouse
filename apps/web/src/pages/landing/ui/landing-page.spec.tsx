import { screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/shared/lib/test-utils';

import { LandingPage } from './landing-page';

vi.mock('@/shared/i18n/routing/navigation', () => ({
  Link: (props: ComponentProps<'a'>) => <a {...props} />,
  usePathname: () => '/',
  useRouter: () => ({ replace: vi.fn() }),
}));

describe('LandingPage', () => {
  it('отображает секции лендинга на русском', () => {
    renderWithProviders(<LandingPage />);

    expect(
      screen.getByRole('heading', { level: 1, name: /соберите склад и наблюдайте/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Как это работает' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Возможности' })).toBeInTheDocument();
    expect(screen.getByText('Шаг 01')).toBeInTheDocument();
    expect(screen.getByText('3 робота')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Начать работу' })).toHaveAttribute('href', '/login');
  });

  it('переводится на английский', () => {
    renderWithProviders(<LandingPage />, { locale: 'en' });

    expect(
      screen.getByRole('heading', { level: 1, name: /build a warehouse/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('3 robots')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true');
  });
});

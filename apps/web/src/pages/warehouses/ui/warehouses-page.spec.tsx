import { fireEvent, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/shared/lib/test-utils';

import { WarehousesPage } from './warehouses-page';

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

vi.mock('@/shared/i18n/routing/navigation', () => ({
  Link: (props: ComponentProps<'a'>) => <a {...props} />,
  usePathname: () => '/warehouses',
  useRouter: () => ({ replace: vi.fn() }),
}));

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

it('opens the filter from the account link and keeps the URL in sync with the tabs', () => {
  window.history.replaceState(null, '', '/ru/warehouses?filter=mine&view=cards#list');
  const { rerender } = renderWithProviders(<WarehousesPage />);

  expect(screen.getByRole('banner')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Swarmhouse/ })).toHaveAttribute('href', '/');
  expect(screen.getByRole('button', { name: 'Русский' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Как это работает' })).not.toBeInTheDocument();

  expect(screen.getByRole('tab', { name: /Мои/ })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByText('Центральный склад')).toBeInTheDocument();
  expect(screen.queryByText('Учебный склад')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('tab', { name: /Все/ }));
  expect(window.location.search).toBe('?view=cards');
  expect(window.location.hash).toBe('#list');

  rerender(<WarehousesPage />);
  expect(screen.getByText('Учебный склад')).toBeInTheDocument();

  window.history.replaceState(null, '', '/ru/warehouses?filter=mine');
  rerender(<WarehousesPage />);
  expect(screen.getByRole('tab', { name: /Мои/ })).toHaveAttribute('aria-selected', 'true');
  expect(screen.queryByText('Учебный склад')).not.toBeInTheDocument();
});

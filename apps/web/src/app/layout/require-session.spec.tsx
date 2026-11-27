import { act, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useSessionStore } from '@/entities/session';
import { renderWithProviders } from '@/shared/lib/test-utils';

import { RequireSession } from './require-session';

const router = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock('@/shared/i18n/routing/navigation', () => ({
  usePathname: () => '/warehouses',
  useRouter: () => router,
}));

describe('RequireSession', () => {
  beforeEach(() => {
    router.replace.mockClear();
    useSessionStore.setState(useSessionStore.getInitialState());
    window.history.replaceState(null, '', '/ru/warehouses?filter=mine#list');
  });

  afterEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('waits for session restoration before redirecting guests', () => {
    renderWithProviders(<RequireSession>Warehouse content</RequireSession>);

    expect(screen.getByRole('status')).toHaveTextContent('Проверяем сессию');
    expect(screen.queryByText('Warehouse content')).not.toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();

    act(() => useSessionStore.getState().startInitialization());
    expect(router.replace).not.toHaveBeenCalled();

    act(() => useSessionStore.getState().clearSession());
    expect(router.replace).toHaveBeenCalledWith({
      pathname: '/login',
      query: { next: '/warehouses?filter=mine#list' },
    });
  });

  it('shows the requested page when the session is restored', () => {
    renderWithProviders(<RequireSession>Warehouse content</RequireSession>);
    act(() => useSessionStore.getState().setAccessToken('access-token'));

    expect(screen.getByText('Warehouse content')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
  });
});

import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useSessionStore } from '@/entities/session';
import { HttpError } from '@/shared/api';
import { renderWithProviders } from '@/shared/lib/test-utils';

import { LoginPage } from './login-page';

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  replace: vi.fn(),
}));

vi.mock('@/entities/session', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/entities/session')>()),
  login: mocks.login,
}));

vi.mock('@/shared/i18n/routing/navigation', () => ({
  Link: (props: ComponentProps<'a'>) => <a {...props} />,
  usePathname: () => '/login',
  useRouter: () => ({ replace: mocks.replace }),
}));

describe('LoginPage', () => {
  beforeEach(() => {
    useSessionStore.setState(useSessionStore.getInitialState());
    useSessionStore.getState().clearSession();
    vi.clearAllMocks();
  });

  afterEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it.each([
    ['', '/warehouses'],
    ['/warehouses?filter=mine#list', '/warehouses?filter=mine#list'],
    ['https://example.com', '/warehouses'],
  ])('signs in with return target "%s"', async (next, destination) => {
    window.history.replaceState(null, '', `/ru/login?next=${encodeURIComponent(next)}`);
    mocks.login.mockResolvedValue({ accessToken: 'access-token' });
    renderWithProviders(<LoginPage />);

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'dispatcher@swarmhouse.local' },
    });
    fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Войти' }));

    await waitFor(() =>
      expect(mocks.login).toHaveBeenCalledWith({
        email: 'dispatcher@swarmhouse.local',
        password: '123456',
      }),
    );
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledExactlyOnceWith(destination));
    expect(useSessionStore.getState().accessToken).toBe('access-token');
  });

  it('waits for session restoration and redirects a signed-in visitor', () => {
    useSessionStore.getState().startInitialization();
    renderWithProviders(<LoginPage />);

    expect(screen.getByRole('status')).toHaveTextContent('Проверяем сессию…');
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument();
    expect(mocks.replace).not.toHaveBeenCalled();

    act(() => useSessionStore.getState().setAccessToken('restored-token'));

    expect(mocks.replace).toHaveBeenCalledExactlyOnceWith('/warehouses');
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument();
  });

  it('shows an error for invalid credentials', async () => {
    mocks.login.mockRejectedValue(
      new HttpError(401, { code: 'UNAUTHORIZED', message: 'Invalid credentials' }),
    );
    renderWithProviders(<LoginPage />);

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'dispatcher@swarmhouse.local' },
    });
    fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Войти' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Неверный email или пароль');
    expect(useSessionStore.getState().accessToken).toBeNull();
  });
});

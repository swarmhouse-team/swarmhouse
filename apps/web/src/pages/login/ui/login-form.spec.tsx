import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HttpError } from '@/shared/api';
import { renderWithProviders } from '@/shared/lib/test-utils';

import { LoginForm } from './login-form';

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  replace: vi.fn(),
  setAccessToken: vi.fn(),
}));

vi.mock('@/entities/session', () => ({
  login: mocks.login,
  useSessionStore: { getState: () => ({ setAccessToken: mocks.setAccessToken }) },
}));

vi.mock('@/shared/i18n/routing/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('signs in and opens the warehouses page', async () => {
    mocks.login.mockResolvedValue({ accessToken: 'access-token' });
    renderWithProviders(<LoginForm />);

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
    expect(mocks.setAccessToken).toHaveBeenCalledWith('access-token');
    expect(mocks.replace).toHaveBeenCalledWith('/warehouses');
  });

  it('shows an error for invalid credentials', async () => {
    mocks.login.mockRejectedValue(
      new HttpError(401, { code: 'UNAUTHORIZED', message: 'Invalid credentials' }),
    );
    renderWithProviders(<LoginForm />);

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'dispatcher@swarmhouse.local' },
    });
    fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Войти' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Неверный email или пароль');
    expect(mocks.setAccessToken).not.toHaveBeenCalled();
  });
});

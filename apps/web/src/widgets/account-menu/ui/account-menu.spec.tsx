import { fireEvent, screen, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, expect, it, vi } from 'vitest';

import { useSessionStore } from '@/entities/session';
import { renderWithProviders } from '@/shared/lib/test-utils';

import { AccountMenu } from './account-menu';

vi.mock('@/shared/i18n/routing/navigation', () => ({
  Link: (props: ComponentProps<'a'>) => <a {...props} />,
}));

afterEach(() => {
  useSessionStore.setState(useSessionStore.getInitialState());
  vi.unstubAllGlobals();
});

it('displays the account details and returns to the sign-in link after logout', async () => {
  const fetchMock = vi.fn(async (url: string) => {
    if (url === '/api/auth/me') {
      return Response.json({ id: 'user-1', name: 'Анна Иванова', email: 'anna@example.com' });
    }
    return new Response(null, { status: 204 });
  });
  vi.stubGlobal('fetch', fetchMock);
  useSessionStore.getState().setAccessToken('access-token');

  renderWithProviders(<AccountMenu />);

  const trigger = screen.getByRole('button', { name: 'Меню аккаунта' });
  expect(await screen.findByText('АИ')).toBeInTheDocument();
  fireEvent.keyDown(trigger, { key: 'Enter' });
  expect(await screen.findByRole('menuitem', { name: 'Мои склады' })).toHaveAttribute(
    'href',
    '/warehouses',
  );
  fireEvent.click(screen.getByRole('menuitem', { name: 'Профиль пользователя' }));

  const dialog = await screen.findByRole('dialog', { name: 'Профиль пользователя' });
  expect(within(dialog).getByText('Анна Иванова')).toBeInTheDocument();
  expect(within(dialog).getByText('anna@example.com')).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Закрыть' }));

  fireEvent.keyDown(trigger, { key: 'Enter' });
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Выйти' }));

  expect(await screen.findByRole('link', { name: 'Войти' })).toHaveAttribute('href', '/login');
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/auth/logout',
    expect.objectContaining({ method: 'POST', credentials: 'include' }),
  );
  expect(useSessionStore.getState().accessToken).toBeNull();
});

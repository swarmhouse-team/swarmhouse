import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/shared/lib/test-utils';

import { HomePage } from './home-page';

function mockFetch(status: number, body: unknown) {
  const fetchMock = vi.fn(async () => Response.json(body, { status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('HomePage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('показывает статус health, запрос идёт через /api', async () => {
    const fetchMock = mockFetch(200, { status: 'ok', db: 'up' });

    renderWithProviders(<HomePage />);

    expect(await screen.findByText('health: ok')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/health',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('показывает перевод ошибки по коду, а не message сервера', async () => {
    mockFetch(503, { code: 'SERVICE_UNAVAILABLE', message: 'Database is unavailable' });

    renderWithProviders(<HomePage />);

    expect(await screen.findByText(/Сервис временно недоступен/)).toBeInTheDocument();
    expect(screen.queryByText(/Database is unavailable/)).not.toBeInTheDocument();
  });

  it('на английском выводит тексты из en.json', async () => {
    mockFetch(200, { status: 'ok', db: 'up' });

    renderWithProviders(<HomePage />, { locale: 'en' });

    expect(await screen.findByText('health: ok')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check again' })).toBeInTheDocument();
  });

  it('на русском выводит тексты из ru.json', async () => {
    mockFetch(200, { status: 'ok', db: 'up' });

    renderWithProviders(<HomePage />);

    expect(await screen.findByRole('button', { name: 'Проверить ещё раз' })).toBeInTheDocument();
  });
});

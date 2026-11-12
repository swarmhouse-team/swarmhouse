import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createQueryClient } from '@/shared/api';

import { HomePage } from './home-page';

function renderWithQuery(ui: ReactNode) {
  return render(<QueryClientProvider client={createQueryClient()}>{ui}</QueryClientProvider>);
}

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

    renderWithQuery(<HomePage />);

    expect(await screen.findByText('health: ok')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/health',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('показывает сообщение из ApiError, если API ответил ошибкой', async () => {
    mockFetch(503, { code: 'SERVICE_UNAVAILABLE', message: 'Database is unavailable' });

    renderWithQuery(<HomePage />);

    expect(await screen.findByText(/Database is unavailable/)).toBeInTheDocument();
  });
});

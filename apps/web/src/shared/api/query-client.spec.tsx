import { toast } from '@robots/ui';
import { API_ERROR_CODES } from '@robots/shared';
import { useMutation } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/shared/lib/test-utils';

import { HttpError } from './http-error';

vi.mock('@robots/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@robots/ui')>()),
  toast: { error: vi.fn() },
}));

const forbidden = new HttpError(403, { code: API_ERROR_CODES.FORBIDDEN, message: 'Forbidden' });

function FailingAction({ silent = false }: { silent?: boolean }) {
  const { mutate } = useMutation({
    mutationFn: () => Promise.reject(forbidden),
    meta: { silent },
  });
  return <button onClick={() => mutate()}>run</button>;
}

describe('тост ошибки мутации', () => {
  afterEach(() => {
    vi.mocked(toast.error).mockClear();
  });

  it('показывает перевод по коду на текущем языке', async () => {
    renderWithProviders(<FailingAction />, { locale: 'en' });

    fireEvent.click(screen.getByRole('button', { name: 'run' }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("You don't have permission for this action");
    });
  });

  it('с meta.silent тост не показывается', async () => {
    renderWithProviders(<FailingAction silent />);

    fireEvent.click(screen.getByRole('button', { name: 'run' }));

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(toast.error).not.toHaveBeenCalled();
  });
});

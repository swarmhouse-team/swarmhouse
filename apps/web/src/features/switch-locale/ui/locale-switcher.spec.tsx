import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/shared/lib/test-utils';

import { LocaleSwitcher } from './locale-switcher';

const replace = vi.fn();

vi.mock('@/shared/i18n/routing/navigation', () => ({
  usePathname: () => '/warehouses',
  useRouter: () => ({ replace }),
}));

describe('LocaleSwitcher', () => {
  beforeEach(() => {
    replace.mockClear();
  });

  it('отмечает текущий язык', () => {
    renderWithProviders(<LocaleSwitcher />, { locale: 'en' });

    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Русский' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('navigation', { name: 'Interface language' })).toBeInTheDocument();
  });

  it('открывает ту же страницу на выбранном языке', () => {
    renderWithProviders(<LocaleSwitcher />);

    fireEvent.click(screen.getByRole('button', { name: 'English' }));

    expect(replace).toHaveBeenCalledWith('/warehouses', { locale: 'en' });
  });

  it('повторный выбор текущего языка ничего не делает', () => {
    renderWithProviders(<LocaleSwitcher />);

    fireEvent.click(screen.getByRole('button', { name: 'Русский' }));

    expect(replace).not.toHaveBeenCalled();
  });
});

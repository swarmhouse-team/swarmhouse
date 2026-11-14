import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Header } from './header';

describe('Header', () => {
  it('Отображает навигацию и ссылку для входа', () => {
    render(<Header />);

    expect(screen.getByRole('banner')).toBeInTheDocument();

    expect(screen.getByRole('link', { name: 'Как это работает' })).toHaveAttribute(
      'href',
      '#how-it-works',
    );

    expect(screen.getByRole('link', { name: 'Возможности' })).toHaveAttribute('href', '#features');

    expect(screen.getByRole('link', { name: 'Войти' })).toHaveAttribute('href', '/login');
  });
});

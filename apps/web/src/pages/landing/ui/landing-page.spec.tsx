import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LandingPage } from './landing-page';

describe('LandingPage', () => {
  it('Отображает секции страницы лендинг', () => {
    render(<LandingPage />);

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /соберите склад и наблюдайте/i,
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'Как это работает',
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'Возможности',
      }),
    ).toBeInTheDocument();

    expect(screen.getByRole('link', { name: 'Начать работу' })).toHaveAttribute('href', '/login');
  });
});

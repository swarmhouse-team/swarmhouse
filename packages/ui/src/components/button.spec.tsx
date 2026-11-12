import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Button } from './button';

describe('Button', () => {
  it('рендерит кнопку с текстом и классами варианта', () => {
    render(<Button variant="destructive">Удалить</Button>);

    const button = screen.getByRole('button', { name: 'Удалить' });
    expect(button).toHaveClass('bg-destructive');
  });

  it('с asChild рендерит дочерний элемент вместо button', () => {
    render(
      <Button asChild>
        <a href="/warehouses">Склады</a>
      </Button>,
    );

    expect(screen.getByRole('link', { name: 'Склады' })).toHaveAttribute('data-slot', 'button');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
